// Reaction-Diffusion display fragment shader
// Simplified from jasonwebb/reaction-diffusion-playground (MIT)
// v4 — Accent-driven ramp: color computed from uniform vec3 accentColor

uniform sampler2D textureToDisplay;
uniform vec3 accentColor;
uniform float maxAlpha;

varying vec2 v_uv;

const vec3 COLOR_BG = vec3(0.0353, 0.0353, 0.0431);  // #09090b

void main() {
  vec4 pixel = texture2D(textureToDisplay, v_uv);
  float B = pixel.g;

  // Derive ramp from accent
  vec3 COLOR_LOW = accentColor * 0.4;
  vec3 COLOR_MID = accentColor;
  vec3 COLOR_HI  = mix(accentColor, vec3(1.0), 0.2);

  float aLow  = smoothstep(0.0, 0.4, B);
  float aMid  = smoothstep(0.3, 0.7, B);
  float aHigh = smoothstep(0.6, 1.0, B);

  float alpha = mix(0.0, 0.12, aLow) + mix(0.0, 0.15, aMid) + mix(0.0, 0.10, aHigh);
  alpha = min(alpha, maxAlpha);

  vec3 color = mix(COLOR_BG, COLOR_LOW, aLow);
  color = mix(color, COLOR_MID, aMid);
  color = mix(color, COLOR_HI, aHigh);

  // Premultiplied alpha output
  gl_FragColor = vec4(color * alpha, alpha);
}
