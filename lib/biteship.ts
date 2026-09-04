export type ShippingItem = {
  name: string;
  description: string;
  value: number;
  quantity: number;
  weight: number;
};

export const SUPPORTED_COURIERS = [
  { code: 'jne', name: 'JNE' },
  { code: 'sicepat', name: 'SiCepat' },
  { code: 'anteraja', name: 'AnterAja' },
  { code: 'jnt', name: 'J&T Express' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'ninja', name: 'Ninja Xpress' },
  { code: 'lion', name: 'Lion Parcel' },
] as const;

export type ShippingOption = {
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName: string;
  price: number;
  duration: string;
};

const ORIGIN_POSTAL_CODE = 44163;
export async function retrieveShippingRates(
  destinationPostalCode: string,
  items: ShippingItem[],
  courierCodes = SUPPORTED_COURIERS.map((courier) => courier.code),
): Promise<ShippingOption[]> {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) throw new Error('Biteship belum dikonfigurasi.');
  const response = await fetch('https://api.biteship.com/v1/rates/couriers', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      origin_postal_code: ORIGIN_POSTAL_CODE,
      destination_postal_code: Number(destinationPostalCode),
      couriers: courierCodes.join(','),
      items: items.map((item) => ({
        ...item,
        weight: item.weight,
        length: 30,
        width: 25,
        height: 5,
      })),
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    pricing?: Array<Record<string, unknown>>;
    message?: string;
  };
  if (!response.ok || !Array.isArray(data.pricing))
    throw new Error(data.message || 'Tarif pengiriman belum tersedia.');
  return data.pricing
    .map((rate) => ({
      courierCode: String(rate.courier_code || ''),
      courierName: String(rate.courier_name || rate.company || ''),
      serviceCode: String(rate.courier_service_code || rate.type || ''),
      serviceName: String(rate.courier_service_name || rate.service_type || ''),
      price: Number(rate.price || 0),
      duration: [rate.shipment_duration_range, rate.shipment_duration_unit]
        .filter(Boolean)
        .join(' '),
    }))
    .filter(
      (rate) =>
        rate.courierCode &&
        rate.serviceCode &&
        Number.isFinite(rate.price) &&
        rate.price > 0,
    )
    .sort((left, right) => left.price - right.price);
}
