import React, { createContext, useContext, useId } from "react";
import { MotionFrame, poseFrame } from "./motion";
import Svg, {
  Path,
  Circle,
  ClipPath,
  Ellipse,
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { Shape } from "./routines";
import { limbContour, Vec } from "./poseGeometry";
import {
  ArmPart,
  figureOf,
  footTransform,
  handTransform,
  headArt,
  layers,
  pt,
  torsoArt,
} from "./figure";
export function Sprig({
  size = 52,
  color = "#8C9779",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 70 70">
      <Path
        d="M14 62 Q45 40 53 7"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      {[0, 1, 2, 3].map((i) => (
        <G key={i} transform={`translate(${i * 9} ${-i * 13})`}>
          <Path d="M24 52 Q4 48 10 31 Q25 34 24 52" fill={color} />
          <Path d="M24 52 Q46 53 47 36 Q31 35 24 52" fill={color} />
        </G>
      ))}
    </Svg>
  );
}
const flat = (p: number[]): Vec => [p[0], p[1]];
const lerp = (a: Vec, b: Vec, t: number): Vec => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
// The character: long, warm-brown hair with curtain bangs, freckles, rosy
// cheeks, green eyes, small silver hoops and a cream-and-green Breton tee.
const INK = {
  skinLine: "#A5776A",
  hairLine: "#3B261A",
  hairShine: "#B88A5E",
  stripe: "#46705A",
  shirtLine: "#B5A991",
  legLine: "#34435C",
  brow: "#6B4935",
  lid: "#3E2B22",
  iris: "#748654",
  lip: "#C9777C",
  mouth: "#8E4850",
  blush: "#E8908C",
  freckle: "#AF7A62",
  silver: "#C7CBD1",
};
// The look chosen in settings; every illustration in the app follows it.
export type Look = { smile: boolean; stripes: boolean; bun: boolean };
export const LookContext = createContext<Look>({
  smile: true,
  stripes: true,
  bun: false,
});
// A Breton tee, or an evenly coloured green sports shirt.
const SHIRTS = {
  stripes: {
    front: ["#FBF7EE", "#F1EADC", "#DED4C1"],
    back: ["#E8E0CF", "#D2C7B2"],
    line: INK.shirtLine,
    neck: "#D8CDB9",
    hem: "#CFC4AF",
  },
  plain: {
    front: ["#7FA48D", "#628B74", "#4A715C"],
    back: ["#628771", "#456654"],
    line: "#2F4A3C",
    neck: "#A7C4B3",
    hem: "#9DBBA9",
  },
};
export function Illustration({
  shape,
  side,
  compact = false,
  frame: suppliedFrame,
}: {
  shape: Shape;
  side?: "left" | "right";
  animate?: boolean;
  paused?: boolean;
  compact?: boolean;
  frame?: MotionFrame;
}) {
  const id = `figure${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const paint = (name: string) => `url(#${id}${name})`;
  const frame = suppliedFrame ?? poseFrame({ shape, side });
  const fig = figureOf(frame, side);
  const torso = torsoArt(fig);
  const look = useContext(LookContext);
  const shirt = look.stripes ? SHIRTS.stripes : SHIRTS.plain;
  const head = headArt(fig, look.bun);
  const arm = (i: 0 | 1, back: boolean, part: ArmPart) => {
    const s = flat(fig.shoulders[i]),
      e = flat(fig.elbows[i]),
      w = flat(fig.wrists[i]);
    const top = lerp(s, e, -0.22),
      cuff = lerp(s, e, 0.3);
    const dx = e[0] - s[0],
      dy = e[1] - s[1],
      l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l,
      ny = dx / l;
    const stripes = [0.06, 0.2].map((k) => {
      const c = lerp(s, e, k),
        r = 6.4 - k * 2;
      return `M${pt([c[0] - nx * r, c[1] - ny * r])} L${pt([c[0] + nx * r, c[1] + ny * r])}`;
    });
    const skin = paint(back ? "skinBack" : "skin");
    // A whole arm is one smooth contour; split arms meet at a rounded elbow.
    const shape = (a: Vec, b: Vec, c: Vec, r: [number, number, number]) => (
      <G>
        <Path
          d={limbContour(a, b, c, r)}
          fill={skin}
          stroke={INK.skinLine}
          strokeOpacity=".16"
          strokeWidth=".6"
        />
        <Path
          d={limbContour(a, b, c, [r[0] * 0.6, r[1] * 0.6, r[2] * 0.4])}
          fill="#FFF3E8"
          opacity={back ? 0.06 : 0.15}
        />
      </G>
    );
    const upperArm =
      part === "lower" ? null : (
        <G>
          {part === "upper" && shape(s, lerp(s, e, 0.5), e, [6.4, 5.7, 4.9])}
          <Path
            d={limbContour(top, lerp(top, cuff, 0.5), cuff, [6.9, 6.6, 6.3])}
            fill={paint(back ? "shirtBack" : "shirt")}
          />
          <Path
            d={`M${pt([cuff[0] + nx * 6.3, cuff[1] + ny * 6.3])} Q${pt([cuff[0] + (dx / l) * 2.2, cuff[1] + (dy / l) * 2.2])} ${pt([cuff[0] - nx * 6.3, cuff[1] - ny * 6.3])}`}
            stroke={shirt.line}
            strokeOpacity=".6"
            strokeWidth=".7"
            fill="none"
          />
          {look.stripes && l > 8 && (
            <Path
              d={stripes.join("")}
              stroke={INK.stripe}
              strokeWidth="2.3"
              // Stripes fade out when the sleeve points at the viewer, where
              // their direction would be meaningless.
              opacity={(back ? 0.7 : 0.85) * Math.min(1, (l - 8) / 10)}
            />
          )}
        </G>
      );
    const forearm =
      part === "upper" ? null : (
        <G>
          {part === "lower" && shape(e, lerp(e, w, 0.5), w, [4.9, 3.9, 2.7])}
          <G transform={handTransform(fig, i)}>
            <Path
              d="M-2 -2.7 C2 -3.1 5 -3.9 8 -3.1 L15 -1.7 Q17 -.9 15.3 .1 L7 .5 Q11 3.2 9.3 4.2 Q8.4 4.8 6.1 3.2 L2 2.8 L-2 2.6Z"
              fill={skin}
            />
            <Path
              d="M7 -.8 L14 -.2 M4 1 Q6 1 7 2"
              stroke="#AF7957"
              strokeWidth=".55"
              fill="none"
              opacity=".55"
            />
          </G>
        </G>
      );
    return (
      <G key={`arm${i}${part}`}>
        {part === "whole" && shape(s, e, w, [6.4, 4.9, 2.7])}
        {part === "whole" ? (
          <>
            {forearm}
            {upperArm}
          </>
        ) : (
          <>
            {upperArm}
            {forearm}
          </>
        )}
      </G>
    );
  };
  const leg = (i: 0 | 1, back: boolean) => {
    const h = flat(fig.hips[i]),
      k = flat(fig.knees[i]),
      a = flat(fig.ankles[i]);
    return (
      <G key={`leg${i}`}>
        <Path
          d={limbContour(h, k, a, [14.2, 9.8, 4.8])}
          fill={paint(back ? "legBack" : "leg")}
          stroke={INK.legLine}
          strokeOpacity=".25"
          strokeWidth=".7"
        />
        <Path
          d={limbContour(h, k, a, [8.6, 6, 2.3])}
          fill="#C7D2E6"
          opacity={back ? 0.03 : 0.08}
        />
        <Path
          d={`M${pt([h[0] + 2, h[1] + 3])} Q${pt([k[0] + 4, k[1] - 2])} ${pt([a[0] + 2, a[1] - 6])}`}
          fill="none"
          stroke="#D6DEEC"
          strokeOpacity=".22"
          strokeWidth=".65"
        />
        <G transform={footTransform(fig, i)}>
          <Path
            d="M-4.5 -6 C-4 -1 -6 2 -5 5 Q-4 7 0 7 L18 7 Q22 6.5 20.7 4.8 Q20.1 3.4 16 3.3 L8 1 Q4 -1 4.5 -6Z"
            fill={paint(back ? "skinBack" : "skin")}
            stroke="#A67854"
            strokeWidth=".5"
            strokeOpacity=".3"
          />
          <Path
            d="M-3 5 Q3 6 6 4 M14 4.2 L14.5 6 M17 4.7 L17.3 6"
            fill="none"
            stroke="#A5714E"
            strokeWidth=".5"
            opacity=".6"
          />
        </G>
      </G>
    );
  };
  const clumps = (front: boolean | null) => {
    const list = head.clumps.filter((c) => front === null || c.front === front);
    return (
      <G>
        {list.map((c, i) => (
          <Path
            key={`clump${i}`}
            d={c.d}
            fill={paint(c.front || front === null ? "hair" : "hairDeep")}
            stroke={INK.hairLine}
            strokeOpacity=".18"
            strokeWidth=".5"
          />
        ))}
        <Path
          d={list.map((c) => c.strand).join("")}
          stroke={INK.hairShine}
          strokeOpacity=".3"
          strokeWidth=".6"
          fill="none"
        />
      </G>
    );
  };
  const curtain = <G key="hair">{clumps(false)}</G>;
  const body = (
    <G key="torso">
      <Path d={torso.body} fill={paint("skin")} />
      <Path
        d={limbContour(head.neck[0], head.neck[1], head.neck[2], [6.3, 5.4, 5.1])}
        fill={paint("skinBack")}
      />
      <Path
        d={torso.shirt}
        fill={paint("shirt")}
        stroke={shirt.line}
        strokeOpacity=".5"
        strokeWidth=".6"
      />
      {look.stripes && (
        <Path
          d={torso.stripes}
          stroke={INK.stripe}
          strokeWidth="2.5"
          fill="none"
          opacity={0.85 * torso.stripeOpacity}
        />
      )}
      <Path
        d={torso.shade}
        stroke="#6E6252"
        strokeOpacity=".12"
        strokeWidth="4"
        fill="none"
      />
      <Path
        d={torso.neckline}
        stroke={shirt.neck}
        strokeWidth="1.3"
        fill="none"
      />
      <Path d={torso.hem} stroke={shirt.hem} strokeWidth=".9" fill="none" />
    </G>
  );
  const sc = head.skull.c;
  const jaw = (
    <Path
      d={head.jaw}
      fill={paint("skin")}
      stroke={INK.skinLine}
      strokeOpacity=".22"
      strokeWidth=".55"
    />
  );
  const face = (
    <G>
      <Defs>
        <ClipPath id={`${id}skull`}>
          <Circle cx={sc[0]} cy={sc[1]} r={head.skull.r} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id}skull)`}>
        <Path d={head.face} fill={paint("skin")} />
      </G>
      {jaw}
      {head.ears.map((e, i) => (
        <G key={`ear${i}`} transform={`translate(${pt(e.c)}) rotate(${e.angle})`}>
          <Ellipse
            rx="2.1"
            ry="3.8"
            fill={paint("skin")}
            stroke={INK.skinLine}
            strokeOpacity=".3"
            strokeWidth=".5"
          />
          <Path
            d="M-.6 -2.4 Q1 -1.2 .2 1.6"
            stroke={INK.skinLine}
            strokeOpacity=".35"
            strokeWidth=".5"
            fill="none"
          />
        </G>
      ))}
      {head.cheeks.map((c, i) => (
        <G key={`cheek${i}`} transform={c.m} opacity={c.o}>
          <Ellipse rx="3.4" ry="2.2" fill={INK.blush} opacity=".3" />
        </G>
      ))}
      <Path
        d={head.freckles
          .map(
            (f) =>
              `M${pt([f[0] - 0.33, f[1]])} a.33 .33 0 1 0 .66 0 a.33 .33 0 1 0 -.66 0`,
          )
          .join("")}
        fill={INK.freckle}
        opacity=".6"
      />
      {head.nose && (
        <G>
          <Path
            d={head.nose.ridge}
            fill={paint("skin")}
            stroke="#B98472"
            strokeWidth=".55"
            strokeOpacity={0.5 * head.nose.ridgeOpacity}
          />
          <Path
            d={head.nose.tip}
            stroke="#B07C6C"
            strokeWidth=".55"
            strokeLinecap="round"
            fill="none"
            opacity=".7"
          />
        </G>
      )}
      {head.mouth && !look.smile && (
        <Path
          d={head.mouth.closed}
          stroke={INK.lip}
          strokeWidth="1.05"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {head.mouth && look.smile && (
        <G>
          <Path d={head.mouth.open} fill={INK.mouth} />
          <Path d={head.mouth.teeth} fill="#FFF9F2" />
          <Path
            d={head.mouth.upper}
            stroke={INK.lip}
            strokeWidth=".7"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={head.mouth.lower}
            stroke={INK.lip}
            strokeWidth="1.15"
            strokeLinecap="round"
            fill="none"
            opacity=".9"
          />
        </G>
      )}
      {head.eyes.map((e, i) => (
        <G key={`eye${i}`} transform={e.m} opacity={e.o}>
          <G transform={e.flip ? "scale(-1 1)" : undefined}>
            <Path d="M-2.4 .2 Q0 -2 2.5 -.2 Q.2 1.1 -2.4 .2Z" fill="#FBF4EE" />
            <Circle cx=".15" cy="-.35" r="1.3" fill={INK.iris} />
            <Circle cx=".15" cy="-.35" r=".6" fill="#2B2520" />
            <Circle cx=".6" cy="-.85" r=".3" fill="#FFFFFF" opacity=".9" />
            <Path
              d="M-2.6 .25 Q0 -2.25 2.6 -.25 L3.25 -.95"
              stroke={INK.lid}
              strokeWidth=".75"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M-1.7 .85 Q.2 1.45 2.1 .45"
              stroke="#B48A78"
              strokeWidth=".4"
              fill="none"
              opacity=".6"
            />
          </G>
        </G>
      ))}
      {head.brows.map((b, i) => (
        <G key={`brow${i}`} transform={b.m} opacity={b.o}>
          <Path
            d="M-2.8 .7 Q-.6 -1.15 2.8 -.15"
            transform={b.flip ? "scale(-1 1)" : undefined}
            stroke={INK.brow}
            strokeWidth="1.05"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      ))}
    </G>
  );
  const bun = (b: NonNullable<typeof head.bun>) => (
    <G>
      <Circle
        cx={b.c[0]}
        cy={b.c[1]}
        r={b.r}
        fill={paint("hair")}
        stroke={INK.hairLine}
        strokeOpacity=".2"
        strokeWidth=".5"
      />
      <Path
        d={b.shine}
        stroke={INK.hairShine}
        strokeOpacity=".45"
        strokeWidth=".9"
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
  const headLayer = (
    <G key="head">
      {head.away && jaw}
      {head.bun && !head.bun.front && bun(head.bun)}
      <Circle cx={sc[0]} cy={sc[1]} r={head.skull.r} fill={paint("hair")} />
      <Path
        d={head.shine}
        stroke={INK.hairShine}
        strokeOpacity=".4"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      {!head.away && face}
      {head.away && clumps(null)}
      {head.part && (
        <Path
          d={head.part}
          stroke={INK.hairLine}
          strokeOpacity=".35"
          strokeWidth=".6"
          fill="none"
        />
      )}
      {head.bangs.map((d, i) => (
        <Path
          key={`bang${i}`}
          d={d}
          fill={paint("hair")}
          stroke={INK.hairLine}
          strokeOpacity=".2"
          strokeWidth=".5"
        />
      ))}
      {!head.away && clumps(true)}
      {head.bun?.front && bun(head.bun)}
      {head.earrings.map((e, i) => (
        <G key={`hoop${i}`}>
          <Circle
            cx={e[0]}
            cy={e[1]}
            r="1.5"
            stroke={INK.silver}
            strokeWidth=".75"
            fill="none"
          />
          <Circle
            cx={e[0] - 0.7}
            cy={e[1] - 0.7}
            r=".3"
            fill="#FFFFFF"
            opacity=".8"
          />
        </G>
      ))}
    </G>
  );
  const parts = layers(fig).map((layer) => {
    switch (layer.kind) {
      case "arm":
        return arm(layer.i, layer.back, layer.part);
      case "leg":
        return leg(layer.i, layer.back);
      case "hair":
        return head.away ? null : curtain;
      case "torso":
        return body;
      case "head":
        return headLayer;
    }
  });
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 360 320"
      accessibilityLabel={`${shape} pose illustration`}
    >
      <Defs>
        <LinearGradient id={`${id}skin`} x1="0%" y1="0%" x2="95%" y2="80%">
          <Stop offset="0" stopColor="#F7DED2" />
          <Stop offset=".5" stopColor="#EFC8B9" />
          <Stop offset="1" stopColor="#DBA898" />
        </LinearGradient>
        <LinearGradient id={`${id}skinBack`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor="#E9C1B2" />
          <Stop offset="1" stopColor="#CB988B" />
        </LinearGradient>
        <LinearGradient id={`${id}leg`} x1="0%" y1="0%" x2="90%" y2="100%">
          <Stop stopColor="#7487A6" />
          <Stop offset=".45" stopColor="#5E7193" />
          <Stop offset="1" stopColor="#47597B" />
        </LinearGradient>
        <LinearGradient id={`${id}legBack`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor="#5C6E8F" />
          <Stop offset="1" stopColor="#3E4D6B" />
        </LinearGradient>
        <LinearGradient id={`${id}shirt`} x1="0%" y1="0%" x2="100%" y2="90%">
          <Stop stopColor={shirt.front[0]} />
          <Stop offset=".6" stopColor={shirt.front[1]} />
          <Stop offset="1" stopColor={shirt.front[2]} />
        </LinearGradient>
        <LinearGradient id={`${id}shirtBack`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor={shirt.back[0]} />
          <Stop offset="1" stopColor={shirt.back[1]} />
        </LinearGradient>
        <LinearGradient id={`${id}hair`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor="#94653F" />
          <Stop offset=".5" stopColor="#74492D" />
          <Stop offset="1" stopColor="#4D3020" />
        </LinearGradient>
        <LinearGradient id={`${id}hairDeep`} x1="0%" y1="0%" x2="80%" y2="100%">
          <Stop stopColor="#7A5034" />
          <Stop offset="1" stopColor="#3E271A" />
        </LinearGradient>
      </Defs>
      <Circle cx="185" cy="158" r="130" fill="#F0E3D1" />
      <Circle cx="74" cy="75" r="22" fill="#DCA77E" opacity=".6" />
      <Path
        d="M0 259 Q65 223 121 255 T250 246 T360 230 L360 320 H0Z"
        fill="#DEDCCB"
      />
      <Path d="M0 278 Q78 251 159 280 T360 269 V320 H0Z" fill="#C9CFBA" />
      {!compact && (
        <G opacity=".7">
          <Path
            d="M27 287 Q13 190 46 133 M26 249 Q61 215 69 169"
            stroke="#859273"
            strokeWidth="2"
            fill="none"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <G key={i} transform={`translate(${i * 3},${-i * 22})`}>
              <Ellipse
                cx="17"
                cy="255"
                rx="7"
                ry="17"
                fill="#96A080"
                rotation="-35"
                origin="17,255"
              />
              <Ellipse
                cx="39"
                cy="246"
                rx="7"
                ry="18"
                fill="#899675"
                rotation="40"
                origin="39,246"
              />
            </G>
          ))}
        </G>
      )}
      <Path d="M56 283 L302 283 L326 298 L36 298Z" fill="#8D9A7E" />
      <Path d="M37 299 H326" stroke="#657558" strokeWidth="2" />
      <Ellipse cx="181" cy="287" rx="112" ry="5" fill="#42573F" opacity=".12" />
      <G>
        {/* The leggings' waist sits under the legs and the shirt hem. */}
        <Path d={torso.waist} fill={paint("leg")} />
        {parts}
      </G>
    </Svg>
  );
}
