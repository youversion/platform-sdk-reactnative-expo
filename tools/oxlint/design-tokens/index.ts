import { eslintCompatPlugin } from "@oxlint/plugins";

import { noRawColorRule } from "./rules/no-raw-color.ts";

/** Oxlint rules that keep UI color usage on design tokens instead of raw literals. */
const designTokensPlugin = eslintCompatPlugin({
	meta: { name: "design-tokens" },
	rules: {
		"no-raw-color": noRawColorRule,
	},
});

export default designTokensPlugin;
