export async function onRequestPost(context) {
  // TODO: first-owner bootstrap.
  // 1. Check if any owner user exists.
  // 2. If yes, reject setup.
  // 3. Hash password securely.
  // 4. Create owner user.
  return new Response('Setup endpoint scaffold. Connect D1 + password hashing next.', { status: 501 });
}
