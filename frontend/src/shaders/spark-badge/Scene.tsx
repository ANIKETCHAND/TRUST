import { SparkBadge } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export type SceneProps = {
  speed?: number;
  particleAmount?: number;
  rainAmount?: number;
  turbulence?: number;
  spread?: number;
};

export function Scene({
  speed = 1.00,
  particleAmount = 1.00,
  rainAmount = 1.00,
  turbulence = 1.00,
  spread = 1.00,
}: SceneProps = {}) {
  return (
    <div className="shader-frame">
      <SparkBadge
        speed={speed}
        particleAmount={particleAmount}
        rainAmount={rainAmount}
        turbulence={turbulence}
        spread={spread}
      />
    </div>
  );
}

export default Scene;
