import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const HEX_PATTERN =
	/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isRawColorLiteral(value: string): boolean {
	if (HEX_PATTERN.test(value)) {
		return true;
	}
	if (/oklch\s*\(/i.test(value)) {
		return true;
	}
	if (/\brgba\s*\(/i.test(value)) {
		return false;
	}
	if (/\brgb\s*\(/i.test(value)) {
		return true;
	}
	return false;
}

function templateStaticValue(node: ESTree.TemplateLiteral): string | null {
	if (node.expressions.length > 0) {
		return null;
	}
	return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join("");
}

/** Disallow raw hex, rgb(), and oklch() color literals outside theme/ token files. */
export const noRawColorRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow raw color literals; use design tokens from theme/ or withAlpha() for alpha fills.",
		},
		messages: {
			rawColor:
				"Raw color literal {{value}} is not allowed. Use a token from theme/ or withAlpha() for alpha fills.",
		},
		schema: [],
	},
	createOnce(context) {
		function checkValue(node: ESTree.Node, value: string): void {
			if (isRawColorLiteral(value)) {
				const display =
					value.length > 40 ? `${value.slice(0, 37)}...` : value;
				context.report({
					node,
					messageId: "rawColor",
					data: { value: display },
				});
			}
		}

		return {
			Literal(node) {
				if (typeof node.value === "string") {
					checkValue(node, node.value);
				}
			},
			TemplateLiteral(node) {
				const value = templateStaticValue(node);
				if (value !== null) {
					checkValue(node, value);
				}
			},
		};
	},
});
