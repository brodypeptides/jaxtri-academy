export async function onRequestPost(context) {
  // TODO: owner login.
  // Verify email/password, role=owner, then create secure session cookie.
  return new Response('Owner login endpoint scaffold.', { status: 501 });
}
