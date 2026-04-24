import { motion, useReducedMotion } from "framer-motion";
import type { ReactElement } from "react";

const emojiItems = [
  { emoji: "📊", left: "8%", delay: 0.2, duration: 9 },
  { emoji: "⚡", left: "26%", delay: 1.1, duration: 7.5 },
  { emoji: "🚀", left: "58%", delay: 0.7, duration: 8.4 },
  { emoji: "🧠", left: "82%", delay: 1.6, duration: 9.6 }
] as const;

export function AnimatedEmojiField(): ReactElement {
  const reducedMotion = useReducedMotion();

  return (
    <div className="emoji-layer" aria-hidden>
      {emojiItems.map((item) => (
        <motion.span
          key={item.emoji + item.left}
          className="emoji-float text-2xl"
          style={{ left: item.left, bottom: "-3rem" }}
          initial={{ opacity: 0, y: 20 }}
          animate={
            reducedMotion
              ? { opacity: 0.2, y: 0 }
              : {
                  opacity: [0, 0.75, 0.8, 0],
                  y: [0, -160, -420, -760],
                  rotate: [0, 6, -6, 12]
                }
          }
          transition={
            reducedMotion
              ? { duration: 0.4 }
              : { duration: item.duration, repeat: Number.POSITIVE_INFINITY, delay: item.delay, ease: "linear" }
          }
        >
          {item.emoji}
        </motion.span>
      ))}
    </div>
  );
}
