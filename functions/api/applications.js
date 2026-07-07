export async function onRequestPost(context) {
  const form = await context.request.formData();
  const data = Object.fromEntries(form.entries());
  // TODO: connect D1 binding: context.env.DB
  // Insert into applications table, then redirect to pending page.
  return Response.redirect(new URL('/pending.html', context.request.url), 302);
}
