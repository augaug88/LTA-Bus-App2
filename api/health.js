/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default async function healthHandler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  if (!accountKey || accountKey.trim() === '') {
    return res.status(503).json({
      keyConfigured: false,
      ltaAnswered: false,
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.',
    });
  }

  try {
    const response = await fetch(
      'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=04121',
      {
        headers: {
          AccountKey: accountKey,
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        keyConfigured: true,
        ltaAnswered: false,
        upstreamStatus: response.status,
        upstreamStatusCode: response.status,
        error: `Upstream LTA error: status ${response.status} (${response.statusText || 'Request failed'})`,
      });
    }

    return res.status(200).json({
      keyConfigured: true,
      ltaAnswered: true,
      upstreamStatus: response.status,
      upstreamStatusCode: response.status,
      message: 'LTA DataMall answered successfully.',
    });
  } catch (err) {
    return res.status(502).json({
      keyConfigured: true,
      ltaAnswered: false,
      error: 'Unable to reach LTA DataMall upstream service',
    });
  }
}
