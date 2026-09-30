import React, { useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import Svg, {
  Path,
  Circle,
  Ellipse,
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { Shape } from "./routines";
import {
  forms,
  interpolatePose,
  limbContour,
  canMorphPose,
  Vec,
} from "./poseGeometry";
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
export function Illustration({
  shape,
  side,
  animate = false,
  paused = false,
  compact = false,
}: {
  shape: Shape;
  side?: "left" | "right";
  animate?: boolean;
  paused?: boolean;
  compact?: boolean;
}) {
  const id = `figure${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const paint = (name: string) => `url(#${id}${name})`;
  const [points, setPoints] = useState(forms[shape]);
  const previous = useRef(forms[shape]);
  const lastPose = useRef({ shape, side });
  const [shownSide, setShownSide] = useState(side);
  const [figureOpacity, setFigureOpacity] = useState(1);
  const [breath, setBreath] = useState(0);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const target = forms[shape],
      from = previous.current;
    const morph = canMorphPose(
      lastPose.current.shape,
      shape,
      lastPose.current.side,
      side,
    );
    lastPose.current = { shape, side };
    let frame: number;
    let start: number | undefined;
    if (!animate || reduced || paused) {
      setPoints(target);
      setShownSide(side);
      setFigureOpacity(1);
      previous.current = target;
      return;
    }
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min((now - start) / 900, 1),
        ease = t * t * (3 - 2 * t);
      if (morph) {
        const next = interpolatePose(from, target, ease);
        setPoints(next);
        previous.current = next;
        setFigureOpacity(1);
        setShownSide(side);
      } else {
        // Fade out, exchange target at zero opacity, then fade in. No invented
        // movement path or mirrored-body flip for arbitrary sequence choices.
        setFigureOpacity(Math.abs(2 * ease - 1));
        if (t >= 0.5) {
          setPoints(target);
          previous.current = target;
          setShownSide(side);
        }
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shape, side, animate, reduced, paused]);
  useEffect(() => {
    if (!animate || paused || reduced) {
      setBreath(0);
      return;
    }
    let frame: number;
    const tick = (now: number) => {
      setBreath(Math.sin(now / 1400) * 1.6);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, paused, reduced]);
  const [
    hx,
    hy,
    sx,
    sy,
    px,
    py,
    lex,
    ley,
    lhx,
    lhy,
    rex,
    rey,
    rhx,
    rhy,
    lkx,
    lky,
    lfx,
    lfy,
    rkx,
    rky,
    rfx,
    rfy,
    headAngle,
    leftFootAngle,
    rightFootAngle,
    front,
  ] = !animate || reduced ? forms[shape] : points;
  const length = Math.hypot(px - sx, py - sy) || 1;
  const ux = (px - sx) / length,
    uy = (py - sy) / length;
  const point = (distance: number, width: number) =>
    `${sx + ux * distance - uy * width} ${sy + uy * distance + ux * width}`;
  const torso = `M${point(0, 17)} C${point(14, 19)} ${point(length * 0.45, 12)} ${point(length * 0.63, 12)} Q${point(length * 0.85, 12)} ${point(length, 18)} Q${point(length + 8, 0)} ${point(length, -18)} C${point(length * 0.65, -10)} ${point(length * 0.45, -14)} ${point(0, -17)} Q${point(-7, 0)} ${point(0, 17)}Z`;
  const top = `M${point(-2, 15)} L${point(-3, 10)} Q${point(14, 0)} ${point(-3, -10)} L${point(-2, -15)} Q${point(13, -20)} ${point(length * 0.3, -16)} Q${point(length * 0.48, -11)} ${point(length * 0.62, -12)} Q${point(length * 0.68, 0)} ${point(length * 0.62, 12)} Q${point(length * 0.43, 13)} ${point(length * 0.3, 16)} Q${point(9, 20)} ${point(-2, 15)}Z`;
  const shoulder = (width: number): Vec => [sx - uy * width, sy + ux * width];
  const hip = (width: number): Vec => [px - uy * width, py + ux * width];
  const arm = (start: Vec, elbow: Vec, wrist: Vec, back = false) => (
    <G>
      <Path
        d={limbContour(start, elbow, wrist, [7, 5.3, 2.7])}
        fill={paint(back ? "skinBack" : "skin")}
        stroke="#A5776A"
        strokeOpacity=".15"
        strokeWidth=".65"
      />
      <Path
        d={limbContour(start, elbow, wrist, [4.3, 3.3, 1.2])}
        fill="#FFF0E2"
        opacity={back ? 0.08 : 0.17}
      />
      <G
        transform={`translate(${wrist[0]} ${wrist[1]}) rotate(${wrist[1] >= 270 && elbow[1] < 255 && hy < 200 ? 0 : (Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]) * 180) / Math.PI})`}
      >
        <Path
          d="M-2 -2.7 C2 -3.1 5 -3.9 8 -3.1 L15 -1.7 Q17 -.9 15.3 .1 L7 .5 Q11 3.2 9.3 4.2 Q8.4 4.8 6.1 3.2 L2 2.8 L-2 2.6Z"
          fill={paint(back ? "skinBack" : "skin")}
        />
        <Path
          d="M7 -.8 L14 -.2 M4 1 Q6 1 7 2"
          stroke="#AF7957"
          strokeWidth=".55"
          fill="none"
          opacity=".6"
        />
      </G>
    </G>
  );
  const leg = (start: Vec, knee: Vec, ankle: Vec, back = false) => (
    <G>
      <Path
        d={limbContour(start, knee, ankle, [14.5, 10.2, 4.7])}
        fill={paint(back ? "leggingsBack" : "leggings")}
        stroke="#435747"
        strokeOpacity=".25"
        strokeWidth=".7"
      />
      <Path
        d={limbContour(start, knee, ankle, [9, 6.2, 2.4])}
        fill="#C1CAA9"
        opacity={back ? 0.025 : 0.07}
      />
      <Path
        d={`M${start[0] + 2} ${start[1] + 3} Q${knee[0] + 5} ${knee[1] - 2} ${ankle[0] + 2} ${ankle[1] - 6}`}
        fill="none"
        stroke="#D5DCC4"
        strokeOpacity=".25"
        strokeWidth=".65"
      />
    </G>
  );
  const foot = (x: number, y: number, angle: number, back = false) => (
    <G transform={`translate(${x} ${y}) rotate(${angle})`}>
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
        opacity=".65"
      />
    </G>
  );
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 360 320"
      accessibilityLabel={`${shape} pose illustration`}
    >
      <Defs>
        <LinearGradient id={`${id}skin`} x1="0%" y1="0%" x2="95%" y2="80%">
          <Stop offset="0" stopColor="#F5D8C9" />
          <Stop offset=".5" stopColor="#EBC2B2" />
          <Stop offset="1" stopColor="#D5A194" />
        </LinearGradient>
        <LinearGradient
          id={`${id}skinBack`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <Stop stopColor="#E5BCAF" />
          <Stop offset="1" stopColor="#C78F85" />
        </LinearGradient>
        <LinearGradient id={`${id}leggings`} x1="0%" y1="0%" x2="90%" y2="100%">
          <Stop stopColor="#9CA58A" />
          <Stop offset=".45" stopColor="#818E73" />
          <Stop offset="1" stopColor="#5E715B" />
        </LinearGradient>
        <LinearGradient
          id={`${id}leggingsBack`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <Stop stopColor="#7D8B71" />
          <Stop offset="1" stopColor="#50694F" />
        </LinearGradient>
        <LinearGradient id={`${id}top`} x1="0%" y1="0%" x2="100%" y2="80%">
          <Stop stopColor="#82967B" />
          <Stop offset=".6" stopColor="#607E65" />
          <Stop offset="1" stopColor="#42644F" />
        </LinearGradient>
        <LinearGradient id={`${id}hair`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop stopColor="#665044" />
          <Stop offset="1" stopColor="#362B29" />
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
      <G
        opacity={figureOpacity}
        transform={
          shownSide === "left" ? "translate(360 0) scale(-1 1)" : undefined
        }
      >
        <G
          transform={`translate(0 ${(paused || reduced ? 0 : breath) * 0.35})`}
        >
          {arm(shoulder(-14), [rex, rey], [rhx, rhy], true)}
          {leg(hip(-6), [rkx, rky], [rfx, rfy - 5], true)}
          {foot(rfx, rfy, rightFootAngle, true)}
          {leg(hip(6), [lkx, lky], [lfx, lfy - 5])}
          {foot(lfx, lfy, leftFootAngle)}
          <Path d={torso} fill={paint("skin")} />
          <Path
            d={`M${point(length * 0.64, -10)} Q${point(length * 0.75, -6)} ${point(length * 0.89, -8)}`}
            stroke="#B37F5E"
            strokeWidth=".7"
            opacity=".45"
            fill="none"
          />
          <Path
            d={`M${point(length * 0.78, 1)} l${ux * 2} ${uy * 2}`}
            stroke="#AD7350"
            strokeWidth="1"
            strokeLinecap="round"
            opacity=".55"
          />
          <Path
            d={`M${point(length * 0.88, 15)} Q${point(length * 0.96, 0)} ${point(length * 0.88, -15)} L${point(length + 3, -18)} Q${point(length + 8, 0)} ${point(length + 3, 18)}Z`}
            fill={paint("leggings")}
          />
          <Path
            d={`M${point(length * 0.91, 14)} Q${point(length * 0.99, 0)} ${point(length * 0.91, -14)}`}
            fill="none"
            stroke="#CED6B8"
            strokeWidth=".7"
            opacity=".5"
          />
          <Path
            d={top}
            fill={paint("top")}
            stroke="#355745"
            strokeOpacity=".35"
            strokeWidth=".65"
          />
          <Path
            d={`M${point(-1, 11)} Q${point(16, 0)} ${point(-1, -11)} M${point(length * 0.56, 12)} Q${point(length * 0.63, 0)} ${point(length * 0.56, -12)}`}
            fill="none"
            stroke="#C5D2B8"
            strokeWidth=".9"
            opacity=".65"
          />
          <Path
            d={`M${point(length * 0.21, 14)} Q${point(length * 0.45, 7)} ${point(length * 0.54, 11)}`}
            stroke="#C6D4BA"
            strokeWidth=".8"
            opacity=".4"
            fill="none"
          />
          {arm(shoulder(14), [lex, ley], [lhx, lhy])}
          <Path
            d={limbContour(
              [sx - ux * 2, sy - uy * 2],
              [(sx + hx) / 2, (sy + hy) / 2],
              [hx, hy + 9],
              [6.7, 5.1, 5.5],
            )}
            fill={paint("skinBack")}
          />
          <G transform={`translate(${hx} ${hy}) rotate(${headAngle})`}>
            <G opacity={front < 0.5 ? 1 : 0}>
              <Path
                d="M-9 -12 C-13 -5 -11 8 -7 13 Q-2 18 4 14 L5 10 Q9 11 10 7 L10 4 L14 2 Q15 1 13 -1 L10 -6 Q12 -13 5 -16 Q-4 -20 -9 -12Z"
                fill={paint("skin")}
                stroke="#A5776A"
                strokeWidth=".5"
                strokeOpacity=".28"
              />
              <Path
                d="M-4 7 Q0 13 5 10 L4 13 Q0 18 -6 12Z"
                fill="#CF9290"
                opacity=".3"
              />
              <Ellipse
                cx="5"
                cy="4"
                rx="3.7"
                ry="2.4"
                fill="#D99091"
                opacity=".22"
              />
              <Path
                d="M-12 -10 C-20 -16 -24 -7 -21 -1 C-19 4 -13 5 -9 0Z"
                fill={paint("hair")}
              />
              <Path
                d="M-19 -9 Q-15 -13 -12 -7 M-21 -4 Q-18 1 -13 -2"
                stroke="#A8896F"
                strokeWidth=".7"
                opacity=".4"
                fill="none"
              />
              <Path
                d="M-10 8 C-16 5 -17 -7 -12 -14 C-9 -20 2 -21 8 -16 Q13 -12 10 -7 Q5 -8 2 -13 Q-3 -9 -5 -4 L-6 6Z"
                fill={paint("hair")}
              />
              <Path
                d="M-11 -11 Q-4 -20 5 -15 M-12 -6 Q-7 -14 0 -15 M-11 -1 Q-9 -8 -5 -11"
                stroke="#B3987A"
                strokeWidth=".6"
                opacity=".4"
                fill="none"
              />
              <Path d="M-6 1 Q-10 -2 -10 3 Q-10 7 -6 7" fill="#E9BDAA" />
              <Path
                d="M-8 2 Q-10 4 -7 5"
                fill="none"
                stroke="#AC8073"
                strokeWidth=".6"
              />
              <Circle cx="-7.3" cy="7.1" r="1" fill="#D7BB78" />
              <Path
                d="M4 -5 Q7 -7 9 -5"
                stroke="#675047"
                strokeWidth=".8"
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M5 -2 Q7 -.3 9 -1.8 M8.5 -1.6 l1 .3"
                stroke="#534B42"
                strokeWidth=".75"
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M10 6 Q7 6.6 6.2 5.8 M8 8.5 L6.5 8.5"
                stroke="#B4777A"
                strokeWidth=".65"
                strokeLinecap="round"
                fill="none"
              />
              {[
                [-1, 2],
                [2, 3],
                [4, 1],
                [6, 3],
                [0, 4],
              ].map(([x, y], i) => (
                <Circle
                  key={`freckle${i}`}
                  cx={x}
                  cy={y}
                  r=".4"
                  fill="#AA7B6A"
                  opacity=".7"
                />
              ))}
              <Path
                d="M-5 -9 Q-8 -3 -5 2 Q-4 4 -5 6"
                fill="none"
                stroke="#705346"
                strokeWidth="1.1"
              />
            </G>
            <G opacity={front >= 0.5 ? 1 : 0}>
              <Path
                d="M-10 -11 Q-18 -16 -23 -8 Q-26 1 -16 4 L-9 0Z"
                fill={paint("hair")}
              />
              <Path
                d="M-12 -9 Q-11 -18 0 -18 Q12 -18 14 -7 L13 5 Q11 14 2 17 Q-8 16 -12 6Z"
                fill={paint("skin")}
                stroke="#AF8175"
                strokeOpacity=".2"
                strokeWidth=".5"
              />
              <Ellipse
                cx="-6"
                cy="5"
                rx="4.5"
                ry="2.9"
                fill="#CF8C91"
                opacity=".22"
              />
              <Ellipse
                cx="9"
                cy="5"
                rx="3.7"
                ry="2.9"
                fill="#CF8C91"
                opacity=".2"
              />
              <Path
                d="M-11 9 C-16 2 -17 -10 -10 -16 Q-4 -21 3 -17 Q12 -19 16 -8 Q18 2 12 9 L11 1 Q8 -5 5 -13 Q-2 -12 -7 -5Z"
                fill={paint("hair")}
              />
              <Path
                d="M2 -17 Q-7 -16 -11 -8 M5 -15 Q9 -13 12 -7 M-13 -5 Q-15 -1 -12 4"
                fill="none"
                stroke="#AC8D74"
                strokeWidth=".75"
                opacity=".6"
              />
              <Path
                d="M-9 -2 Q-12 2 -8 7 M11 -1 Q14 3 11 8"
                fill="none"
                stroke="#76584A"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <Path
                d="M-7 -3 Q-4 -5 -.8 -3.2 M4 -3.3 Q7 -5 10 -2.8"
                fill="none"
                stroke="#70564C"
                strokeWidth=".9"
                strokeLinecap="round"
              />
              <Path
                d="M-7 -.6 Q-4 2 -.8 -.5 M4 -.5 Q7 2 10 -.3"
                fill="#F9EEE7"
                stroke="#66534B"
                strokeWidth=".6"
                strokeLinecap="round"
              />
              <Ellipse cx="-3.7" cy=".3" rx="1" ry="1.05" fill="#788173" />
              <Ellipse cx="7" cy=".3" rx="1" ry="1.05" fill="#788173" />
              <Circle cx="-3.6" cy=".4" r=".5" fill="#423E37" />
              <Circle cx="7" cy=".4" r=".5" fill="#423E37" />
              <Path
                d="M2 1 Q1 4 2 5 Q3 5.5 4 4.7"
                fill="none"
                stroke="#C29386"
                strokeWidth=".65"
                strokeLinecap="round"
              />
              <Path
                d="M-3 8 Q2 10 8 7.5 Q6 13 2 12 Q-1 12 -3 8Z"
                fill="#BA7D80"
              />
              <Path
                d="M-1.9 8.8 Q3 10 6.8 8.5 Q4.5 10.6 1 10.4Z"
                fill="#FFF6E9"
              />
              <Path
                d="M0 13.3 Q3 14 5 12.8"
                fill="none"
                stroke="#D7A69B"
                strokeWidth=".6"
              />
              {[
                [-7, 3],
                [-5, 4],
                [-2, 3],
                [0, 4],
                [4, 3],
                [6, 4],
                [8, 3],
                [10, 5],
                [-4, 6],
              ].map(([x, y], i) => (
                <Circle
                  key={i}
                  cx={x}
                  cy={y}
                  r=".38"
                  fill="#AA7B6A"
                  opacity=".66"
                />
              ))}
              <Circle cx="-10" cy="7.5" r=".85" fill="#DDC498" />
            </G>
          </G>
        </G>
      </G>
    </Svg>
  );
}
