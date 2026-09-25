import { quantityLimit, isPreorder } from '@/lib/preorder';
import { paymentTokenHash } from '@/lib/payment-access';
import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { retrieveShippingRates } from '@/lib/biteship';
import { getEnabledCourierCodes } from '@/lib/shipping-settings';
import {
  biteshipConfig,
  getStoreSettings,
  manualPaymentConfig,
  midtransConfig,
  orderPrefix,
} from '@/lib/store-settings';
import { getCurrentStore, storeBaseUrl, storeNotFound } from '@/lib/tenant';

type RequestedItem = { id: string; variantIndex: number; quantity: number };
type StoredVariant = {
  sku?: string;
  color: string;
  size: string;
  price: number;
  stock: number;
};


export async function POST(request: Request) {
  try {
    const store = await getCurrentStore();
    if (!store) return storeNotFound();
    const body = (await request.json()) as {
      customerName?: string;
      customerPhone?: string;
      shippingAddress?: string;
      paymentMethod?: 'midtrans' | 'manual';
      destinationPostalCode?: string;
      shippingOption?: { courierCode?: string; serviceCode?: string };
      items?: RequestedItem[];
    };
    const name = body.customerName?.trim();
    const phone = body.customerPhone?.trim();
    const address = body.shippingAddress?.trim();
    const paymentMethod =
      body.paymentMethod === 'manual' ? 'manual' : 'midtrans';
    const requestedItems = body.items ?? [];
    const destinationPostalCode = body.destinationPostalCode?.trim() || '';
    if (
      !name ||
      name.length < 2 ||
      name.length > 120 ||
      !phone ||
      !/^\+?[0-9\s-]{8,20}$/.test(phone) ||
      !address ||
      address.length < 10 ||
      address.length > 1000 ||
      !/^\d{5}$/.test(destinationPostalCode) ||
      !body.shippingOption?.courierCode ||
      !body.shippingOption?.serviceCode ||
      !requestedItems.length ||
      requestedItems.length > 50 ||
      requestedItems.some(
        (item) =>
          !item.id ||
          !Number.isInteger(item.variantIndex) ||
          item.variantIndex < 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 99,
      )
    )
      return NextResponse.json(
        { error: 'Lengkapi nama, WhatsApp, alamat, dan produk dengan benar.' },
        { status: 400 },
      );

    // The payment method must be available for this store before anything is saved.
    const settings = await getStoreSettings(store.id);
    const manual = manualPaymentConfig(settings);
    const midtransKeys =
      paymentMethod === 'midtrans' ? await midtransConfig(store.id, settings) : null;
    if (paymentMethod === 'manual' && !manual)
      return NextResponse.json(
        { error: 'Transfer manual belum tersedia di toko ini.' },
        { status: 409 },
      );
    if (paymentMethod === 'midtrans' && !midtransKeys)
      return NextResponse.json(
        {
          error: manual
            ? 'Pembayaran otomatis belum tersedia. Silakan pilih transfer manual.'
            : 'Pembayaran otomatis belum tersedia di toko ini.',
        },
        { status: 503 },
      );

    const d1 = getD1();
    const items: Array<{
      id: string;
      name: string;
      sku?: string;
      color: string;
      size: string;
      price: number;
      quantity: number;
      weight: number;
      preorder: boolean;
      preorderDays: number;
    }> = [];
    for (const requested of requestedItems) {
      const product = await d1
        .prepare(
          'SELECT id,name,variants_json,weight_grams,preorder_enabled,preorder_days FROM products WHERE id=? AND store_id=? AND active=1 AND deleted_at IS NULL',
        )
        .bind(requested.id, store.id)
        .first<{
          id: string;
          name: string;
          variants_json: string;
          weight_grams: number;
          preorder_enabled: number;
          preorder_days: number;
        }>();
      if (!product)
        return NextResponse.json(
          { error: 'Salah satu produk sudah tidak tersedia.' },
          { status: 409 },
        );
      let variants: StoredVariant[] = [];
      try {
        variants = JSON.parse(product.variants_json || '[]');
      } catch {}
      const variant = variants[requested.variantIndex];
      if (
        !variant ||
        !Number.isFinite(variant.price) ||
        variant.price <= 0 ||
        !Number.isInteger(variant.stock) ||
        quantityLimit(product, variant) < requested.quantity
      )
        return NextResponse.json(
          {
            error: `Stok atau varian ${product.name} sudah berubah. Periksa keranjang.`,
          },
          { status: 409 },
        );
      items.push({
        id: product.id,
        name: product.name,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        price: variant.price,
        quantity: requested.quantity,
        weight: product.weight_grams,
        preorder: isPreorder(product, variant),
        preorderDays: isPreorder(product, variant) ? product.preorder_days : 0,
      });
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const enabledCouriers = await getEnabledCourierCodes(store.id);
    if (!enabledCouriers.length)
      return NextResponse.json(
        { error: 'Pengiriman sedang dinonaktifkan.' },
        { status: 409 },
      );
    const shippingOptions = await retrieveShippingRates(
      destinationPostalCode,
      items.map((item) => ({
        name: item.name,
        description: `${item.color} ${item.size}`.trim(),
        value: item.price,
        quantity: item.quantity,
        weight: item.weight,
      })),
      enabledCouriers,
      await biteshipConfig(store.id, settings),
    );
    const selectedShipping = shippingOptions.find(
      (option) =>
        option.courierCode === body.shippingOption?.courierCode &&
        option.serviceCode === body.shippingOption?.serviceCode,
    );
    if (!selectedShipping)
      return NextResponse.json(
        {
          error:
            'Pilihan pengiriman sudah berubah. Silakan cek ongkir kembali.',
        },
        { status: 409 },
      );
    const shipping = selectedShipping.price;
    const total = subtotal + shipping;
    const paymentAccessToken = crypto.randomUUID() + crypto.randomUUID();
    const accessHash = await paymentTokenHash(paymentAccessToken);
    const now = new Date().toISOString();
    const orderNumber = `${orderPrefix(store, settings)}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const paymentLabel = midtransKeys
      ? 'Midtrans QRIS / Virtual Account'
      : (manual?.bankName ?? 'Transfer manual');
    await d1
      .prepare(
        'INSERT INTO orders (store_id, order_number, customer_name, customer_phone, shipping_address, items_json, subtotal, shipping, total, payment_method, status, created_at, updated_at, payment_token_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        store.id,
        orderNumber,
        name,
        phone,
        `${address}\nKode pos: ${destinationPostalCode}\nKurir: ${selectedShipping.courierName} ${selectedShipping.serviceName}${selectedShipping.duration ? ` · ${selectedShipping.duration}` : ''}`,
        JSON.stringify(items),
        subtotal,
        shipping,
        total,
        paymentLabel,
        'menunggu_pembayaran',
        now,
        now,
        accessHash,
      )
      .run();

    if (!midtransKeys)
      return NextResponse.json({
        orderNumber,
        total,
        paymentMethod,
        paymentAccessToken,
        manualPayment: manual,
      });

    const { serverKey, clientKey } = midtransKeys;

    const midtransResponse = await fetch(
      midtransKeys.production
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${serverKey}:`)}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          transaction_details: { order_id: orderNumber, gross_amount: total },
          callbacks: {
            finish: `${await storeBaseUrl(store)}/checkout?order_id=${encodeURIComponent(orderNumber)}`,
          },
          item_details: [
            ...items.map((item, index) => ({
              id: (item.sku || `${item.id}-${index}`).slice(0, 50),
              price: item.price,
              quantity: item.quantity,
              name: `${item.name} ${item.color} ${item.size}`.slice(0, 50),
            })),
            {
              id: 'shipping',
              price: shipping,
              quantity: 1,
              name: 'Pengiriman',
            },
          ],
          customer_details: {
            first_name: name,
            phone,
            billing_address: { first_name: name, phone, address },
            shipping_address: { first_name: name, phone, address },
          },
          enabled_payments: [
            'gopay',
            'other_qris',
            'bca_va',
            'bni_va',
            'bri_va',
            'permata_va',
            'echannel',
          ],
          expiry: { duration: 24, unit: 'hours' },
        }),
      },
    );
    const midtrans = (await midtransResponse.json().catch(() => ({}))) as {
      token?: string;
      redirect_url?: string;
    };
    if (!midtransResponse.ok || !midtrans.token) {
      await d1
        .prepare('DELETE FROM orders WHERE order_number=? AND store_id=?')
        .bind(orderNumber, store.id)
        .run();
      return NextResponse.json(
        {
          error:
            'Midtrans belum dapat membuat pembayaran. Pilih transfer Mandiri atau coba lagi.',
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      orderNumber,
      total,
      paymentMethod,
      paymentAccessToken,
      token: midtrans.token,
      redirectUrl: midtrans.redirect_url,
      clientKey,
    });
  } catch {
    return NextResponse.json(
      { error: 'Pesanan belum dapat disimpan. Coba lagi.' },
      { status: 500 },
    );
  }
}
