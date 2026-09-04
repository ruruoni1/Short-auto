import React from "react";
import {AbsoluteFill, Composition} from "remotion";
import {frameToUs} from "@nihon-zupzup/core";

const CoreSmokeComposition = () => {
  const oneSecondUs = frameToUs(30, {numerator: 30, denominator: 1});
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: "#171817",
        color: "#f7f7f4",
        display: "flex",
        fontFamily: "sans-serif",
        justifyContent: "center",
      }}
    >
      <div style={{textAlign: "center"}}>
        <p style={{color: "#d6ff4b", fontSize: 28}}>니혼줍줍 Studio</p>
        <h1 style={{fontSize: 68, margin: 0}}>Remotion 연결 준비 완료</h1>
        <p style={{fontSize: 24}}>30 frames = {oneSecondUs}µs</p>
      </div>
    </AbsoluteFill>
  );
};

export const RemotionRoot = () => (
  <Composition
    id="CoreSmoke"
    component={CoreSmokeComposition}
    durationInFrames={90}
    fps={30}
    width={1920}
    height={1080}
  />
);
