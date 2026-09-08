import "server-only";

/**
 * The current time, captured once per server render.
 *
 * Components that show relative times ("in 3 days", "Past") need a reference
 * point. Reading the clock inside a component's render body is a purity
 * hazard — in a Client Component it produces values that drift between the
 * server-rendered HTML and hydration. Capturing it here, in a server-only
 * module, and passing the result down as a prop keeps the rendered output a
 * pure function of its inputs.
 */
export function serverNow(): Date {
  return new Date();
}

export function serverNowMs(): number {
  return Date.now();
}
