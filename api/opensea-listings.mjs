const OPENSEA_API = 'https://api.opensea.io/api/v2'
const COLLECTION_SLUG = 'rhmachines'
const V2_COLLECTION_ADDRESS = '0x8c71d170fbd94bcba93bb08fc2cfd0e8620cd9ce'

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function extractMachineIds(listings) {
  const machineIds = new Set()

  for (const listing of listings) {
    const offer = listing?.protocol_data?.parameters?.offer
    if (!Array.isArray(offer)) continue

    for (const item of offer) {
      if (String(item?.token ?? '').toLowerCase() !== V2_COLLECTION_ADDRESS) continue
      const identifier = String(item?.identifierOrCriteria ?? '')
      if (!/^\d+$/.test(identifier)) continue
      const machineId = Number(identifier)
      if (Number.isSafeInteger(machineId) && machineId > 0) machineIds.add(machineId)
    }
  }

  return [...machineIds]
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const apiKey = process.env.OPENSEA_API_KEY
  if (!apiKey) {
    return response.status(503).json({
      error: 'OpenSea scanning is not configured. Add OPENSEA_API_KEY to this Vercel project.',
    })
  }

  const next = getQueryValue(request.query?.next)
  if (next && (typeof next !== 'string' || next.length > 500)) {
    return response.status(400).json({ error: 'Invalid OpenSea cursor.' })
  }

  const url = new URL(`${OPENSEA_API}/listings/collection/${COLLECTION_SLUG}/all`)
  url.searchParams.set('limit', '100')
  if (next) url.searchParams.set('next', next)

  try {
    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json',
        'x-api-key': apiKey,
      },
    })
    const payload = await upstream.json().catch(() => ({}))

    if (!upstream.ok) {
      const upstreamMessage = Array.isArray(payload?.errors) ? payload.errors.join(' ') : payload?.detail
      return response.status(upstream.status).json({
        error: upstreamMessage || `OpenSea returned HTTP ${upstream.status}.`,
      })
    }

    response.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response.status(200).json({
      machineIds: extractMachineIds(Array.isArray(payload?.listings) ? payload.listings : []),
      next: typeof payload?.next === 'string' && payload.next ? payload.next : null,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to reach OpenSea.',
    })
  }
}
