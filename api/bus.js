/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default async function busHandler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  if (!accountKey || accountKey.trim() === '') {
    return res.status(503).json({
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.',
    });
  }

  const busStopCode = (req.query && req.query.BusStopCode)
    ? String(req.query.BusStopCode).trim()
    : '04121';

  try {
    const response = await fetch(
      `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode || '04121')}`,
      {
        headers: {
          AccountKey: accountKey,
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream LTA error: status ${response.status} (${response.statusText || 'Request failed'})`,
        upstreamStatus: response.status,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return res.status(502).json({
        error: 'Failed to parse JSON response from LTA DataMall',
        upstreamStatus: response.status,
      });
    }

    // Set Cache-Control header: LTA refreshes every 20 seconds
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

    // Treat an empty Services array as "no buses running", not as an error
    const rawServices = Array.isArray(data?.Services) ? data.Services : [];
    const nowMs = Date.now();

    const simplifiedList = rawServices.map((service) => {
      const rawBuses = [service?.NextBus, service?.NextBus2];
      const nextBuses = [];

      for (const bus of rawBuses) {
        if (bus && typeof bus.EstimatedArrival === 'string' && bus.EstimatedArrival.trim() !== '') {
          const arrivalMs = new Date(bus.EstimatedArrival).getTime();
          if (!isNaN(arrivalMs) && isFinite(arrivalMs)) {
            const diffMs = arrivalMs - nowMs;
            const minutes = Math.max(0, Math.floor(diffMs / 60000));
            if (!isNaN(minutes) && isFinite(minutes)) {
              nextBuses.push(minutes);
            }
          }
        }
      }

      return {
        ServiceNo: service?.ServiceNo || '',
        nextBuses,
        minutes: nextBuses,
      };
    });

    return res.status(200).json(simplifiedList);
  } catch (err) {
    return res.status(502).json({
      error: 'Unable to reach LTA DataMall upstream service',
    });
  }
}
