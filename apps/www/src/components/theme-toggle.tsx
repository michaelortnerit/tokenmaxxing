import { Moon, Sun } from "lucide-react";

import { Button } from "./ui/button";

/**
 * Flips the `dark` class and persists the choice; the root bootstrap script
 * replays it before paint on the next load.
 */
function ThemeToggle() {
  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    localStorage.setItem("tmx.theme", dark ? "dark" : "light");
  };

  return (
    <Button
      aria-label="Toggle theme"
      className="border border-border"
      onClick={toggle}
      size="icon"
      variant="ghost"
    >
      <Sun className="block size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}

export { ThemeToggle };
