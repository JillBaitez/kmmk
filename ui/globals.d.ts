// Minimal ambient declaration for Chrome extension API in the UI bundle
// This suppresses TS errors where the chrome namespace is used in the frontend code.
declare var chrome: any;

// Minimal JSX typings to avoid dependency on @types/react
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
  interface IntrinsicAttributes {
    key?: any;
  }
}
