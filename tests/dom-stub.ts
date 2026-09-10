/**
 * Just enough DOM to run the playground's script.
 *
 * The alternative is a jsdom dependency to test one file, and jsdom would also
 * make it tempting to test against a copy of the markup rather than against
 * the shipped string. This runs the real script and the real ids.
 *
 * Elements register themselves under whatever id they are given, including the
 * ones the script builds at runtime, so a test can reach a gradient stop row by
 * `el("bgStop1")` exactly as the script does.
 */

export class StubElement {
  value = "";
  disabled = false;
  hidden = false;
  open = false;
  src = "";
  type = "";
  title = "";
  className = "";
  textContent = "";
  placeholder = "";
  readonly style: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  readonly children: StubElement[] = [];
  options: Array<{ value: string }> = [];
  tagName = "INPUT";

  private listeners: Record<string, Array<(e: unknown) => void>> = {};
  readonly classList = { toggle: () => {}, add: () => {}, remove: () => {} };

  private _id = "";

  constructor(private readonly registry: Map<string, StubElement>) {}

  get id() {
    return this._id;
  }

  /** Setting an id is what puts a runtime-built element within reach. */
  set id(value: string) {
    this._id = value;
    this.registry.set(value, this);
  }

  addEventListener(type: string, fn: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(fn);
  }

  fire(type: string, event: Record<string, unknown> = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ key: "", ...event });
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  append(...nodes: StubElement[]) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: StubElement[]) {
    // Rows are rebuilt wholesale, and the old ones must stop answering to
    // their ids or a removed stop would still be reachable. The ids sit on the
    // inputs inside each row rather than on the row, so this has to recurse.
    for (const old of this.children) old.unregister();
    this.children.length = 0;
    this.children.push(...nodes);
  }

  private unregister() {
    if (this._id && this.registry.get(this._id) === this) this.registry.delete(this._id);
    for (const child of this.children) child.unregister();
  }

  select() {}
}

export interface Dom {
  el(id: string): StubElement;
  has(id: string): boolean;
  document: unknown;
}

export function createDom(ids: string[], selects: Record<string, string[]>, values: Record<string, string>): Dom {
  const registry = new Map<string, StubElement>();

  for (const id of ids) {
    const el = new StubElement(registry);
    el.id = id;
    if (selects[id]) {
      el.tagName = "SELECT";
      el.options = selects[id].map((value) => ({ value }));
      el.value = el.options[0].value;
    }
    if (values[id] != null) el.value = values[id];
  }

  return {
    el: (id) => {
      const found = registry.get(id);
      if (!found) throw new Error(`No element with id "${id}"`);
      return found;
    },
    has: (id) => registry.has(id),
    document: {
      getElementById: (id: string) => registry.get(id) ?? null,
      createElement: () => new StubElement(registry),
    },
  };
}
