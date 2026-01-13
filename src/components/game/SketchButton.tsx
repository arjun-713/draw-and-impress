import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const sketchButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 active:translate-y-0.5 active:shadow-none border-3",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-foreground shadow-sketch hover:brightness-110",
        secondary:
          "bg-secondary text-secondary-foreground border-foreground shadow-sketch hover:brightness-110",
        accent:
          "bg-accent text-accent-foreground border-foreground shadow-sketch hover:brightness-110",
        success:
          "bg-success text-success-foreground border-foreground shadow-sketch hover:brightness-110",
        warning:
          "bg-warning text-warning-foreground border-foreground shadow-sketch hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground border-foreground shadow-sketch hover:brightness-110",
        purple:
          "bg-purple text-purple-foreground border-foreground shadow-sketch hover:brightness-110",
        outline:
          "bg-card text-foreground border-foreground shadow-sketch hover:bg-muted",
        ghost:
          "border-transparent hover:bg-muted",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-lg",
        default: "h-12 px-6 text-base rounded-xl",
        lg: "h-14 px-8 text-lg rounded-xl",
        xl: "h-16 px-10 text-xl rounded-2xl",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface SketchButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sketchButtonVariants> {
  asChild?: boolean;
}

const SketchButton = React.forwardRef<HTMLButtonElement, SketchButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(sketchButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
SketchButton.displayName = "SketchButton";

export { SketchButton, sketchButtonVariants };
