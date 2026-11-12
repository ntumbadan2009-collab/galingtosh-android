import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop, Path } from "react-native-svg";

export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F7B64D" />
            <Stop offset="0.52" stopColor="#B34DFF" />
            <Stop offset="1" stopColor="#F06BBE" />
          </LinearGradient>
        </Defs>
        <Path d="M24 3C12.4 3 3 11.8 3 22.7c0 6.1 3 11.5 7.8 15.1L8 45l10.4-4.1c1.8.5 3.7.8 5.6.8 11.6 0 21-8.8 21-19.7S35.6 3 24 3Z" fill="url(#brand)" />
        {[{x:15,y:17},{x:28,y:14},{x:35,y:25},{x:25,y:34},{x:13,y:29}].map((p,i)=><Circle key={i} cx={p.x} cy={p.y} r="4.2" fill="#100C20" />)}
        <Circle cx="24" cy="24" r="2.8" fill="#100C20" />
      </Svg>
    </View>
  );
}