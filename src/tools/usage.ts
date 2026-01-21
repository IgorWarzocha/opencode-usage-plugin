/**
 * Provides a simple tool wrapper for usage info.
 * Keeps tool definitions separate from hooks and rendering.
 */

import { tool } from "@opencode-ai/plugin"

export const usageTool = () =>
  tool({
    description: "Get current rate limit snapshots for all providers",
    args: {},
    async execute() {
      return "Run /usage in the chat to see current limits."
    },
  })
