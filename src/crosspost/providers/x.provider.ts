/**
 * X (Twitter) — post a tweet on behalf of a connected user.
 * Requires an OAuth2 user access token with the `tweet.write` scope
 * (obtained via the per-user connect flow). Docs: POST https://api.x.com/2/tweets.
 */
export async function postToX(userAccessToken: string, text: string): Promise<{ id: string }> {
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  })
  if (!res.ok) throw new Error(`X ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data?: { id: string } }
  return { id: json.data?.id ?? '' }
}
