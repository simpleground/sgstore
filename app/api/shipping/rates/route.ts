import { quantityLimit, isPreorder } from '@/lib/preorder';
import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { retrieveShippingRates } from '@/lib/biteship';
import { getEnabledCourierCodes } from '@/lib/shipping-settings';

type RequestedItem = { id: string; variantIndex: number; quantity: number };
type StoredVariant = {
  color: string;
  size: string;
  price: number;
  stock: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      destinationPostalCode?: string;
      items?: RequestedItem[];
    };
    const postalCode = body.destinationPostalCode?.trim() || '';
    const requestedItems = body.items || [];
    if (
      !/^\d{5}$/.test(postalCode) ||
      !requestedItems.length ||
      requestedItems.length > 50
    )
      return NextResponse.json(
        { error: 'Masukkan kode pos tujuan 5 digit.' },
        { status: 400 },
      );

    const d1 = getD1();
    const items = [];
    for (const requested of requestedItems) {
      if (
        !requested.id ||
        !Number.isInteger(requested.variantIndex) ||
        !Number.isInteger(requested.quantity) ||
        requested.quantity < 1
      )
        return NextResponse.json(
          { error: 'Isi keranjang tidak valid.' },
          { status: 400 },
        );
      const product = await d1
        .prepare(
          'SELECT id,name,variants_json,weight_grams,preorder_enabled,preorder_days FROM products WHERE id=? AND active=1 AND deleted_at IS NULL',
        )
        .bind(requested.id)
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
          { error: 'Produk tidak tersedia.' },
          { status: 409 },
        );
      let variants: StoredVariant[] = [];
      try {
        variants = JSON.parse(product.variants_json || '[]');
      } catch {}
      const variant = variants[requested.variantIndex];
      if (!variant || quantityLimit(product, variant) < requested.quantity)
        return NextResponse.json(
          { error: `Stok ${product.name} sudah berubah.` },
          { status: 409 },
        );
      items.push({
        name: product.name,
        description: `${variant.color} ${variant.size}`.trim(),
        value: variant.price,
        quantity: requested.quantity,
        weight: product.weight_grams,
      });
    }
    const couriers = await getEnabledCourierCodes();
    if (!couriers.length)
      return NextResponse.json(
        { error: 'Pengiriman sedang dinonaktifkan.' },
        { status: 409 },
      );
    const options = await retrieveShippingRates(postalCode, items, couriers);
    return NextResponse.json({
      options: options.slice(0, 20),
      mode: 'sandbox',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Gagal mengambil tarif pengiriman.',
      },
      { status: 502 },
    );
  }
}
