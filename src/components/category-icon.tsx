import { Camera, Palette, Sparkles, Wind, Wrench, Zap, type LucideProps } from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  wind: Wind,
  zap: Zap,
  wrench: Wrench,
  sparkles: Sparkles,
  camera: Camera,
  palette: Palette,
};

export function CategoryIcon({ icon, ...props }: { icon: string } & LucideProps) {
  const Icon = ICONS[icon] ?? Wrench;
  return <Icon {...props} />;
}
