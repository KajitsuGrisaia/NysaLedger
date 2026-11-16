export function orbitalPose(index, elapsed) {
  const durations=[48000,58000,67000], electronDurations=[18000,23000,27000];
  const direction=index===1?-1:1;
  return {angle:(-25+index*65)*Math.PI/180+elapsed*Math.PI*2/durations[index]*direction,
    tilt:[66,70,68][index]*Math.PI/180,
    electron:elapsed*Math.PI*2/electronDurations[index]*direction+index*Math.PI*2/3};
}
