# Reuse Web SDK content with native presentation

We reuse complex Bible UI from `@youversion/platform-react-ui` through Expo DOM components, but native wrappers own mobile presentation and coordination state. This means mobile interactions should reuse Web SDK content and semantic payloads while replacing web-only presentation shells, such as Radix Popover, with native surfaces like `NativeSheet`.

This trade-off accepts WebView boundaries so the SDK can share rendering logic and future Web SDK fixes, while avoiding web presentation patterns that feel wrong or perform poorly on mobile. Native wrappers keep cross-component state outside the DOM runtime because Expo DOM WebViews do not share React context or state with React Native.
