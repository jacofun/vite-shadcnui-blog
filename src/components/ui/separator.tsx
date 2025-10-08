import * as React from "react";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & {
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
  }
>(({ className, orientation = "horizontal", decorative = true, role, ...props }, ref) => {
  const ariaOrientation = orientation === "vertical" ? "vertical" : "horizontal";

  return (
    <div
      ref={ref}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? "none" : role ?? "separator"}
      data-orientation={ariaOrientation}
      className={cn(
        "shrink-0 bg-border/60",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  );
});
Separator.displayName = "Separator";

export { Separator };
