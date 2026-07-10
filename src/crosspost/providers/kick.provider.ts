/**
 * Kick — posts the text as a CHAT MESSAGE to the user's channel. Kick has no
 * social feed/timeline; chat is its only "post" primitive. Requires an OAuth
 * token with `chat:write` + the user's `broadcaster_user_id` (their channel).
 * Docs: POST https://api.kick.com/public/v1/chat (content ≤ 500 chars).
 */
export async function postToKick(
  userAccessToken: string,
  broadcasterUserId: number,
  text: string,
): Promise<{ messageId: string }> {
  const res = await fetch('https://api.kick.com/public/v1/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'user',
      content: text.slice(0, 500),
      broadcaster_user_id: broadcasterUserId,
    }),
  })
  if (!res.ok) throw new Error(`Kick ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { message_id?: string }
  return { messageId: json.message_id ?? '' }
}
