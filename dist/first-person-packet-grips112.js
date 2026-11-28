// First-person fits measured against the textured food mesh and skinned finger pads.
// wristRoll turns the palm inward around the wrist-to-knuckle axis.
export const FIRST_PERSON_FOOD_FITS={
  burger: {
    position: [-0.007726, 0.11161, -0.157821], rotation: [-3.034712, -0.624469, -1.66779],
    palmRoll: -Math.PI/2, wristRoll: 134 * Math.PI/180,
    size: [1.1, 0.83, 1.1],
    profile: {
      Index: [0.523187, 1.5, 0.334836, 0.61441],
      Middle: [1.252731, 1.166319, 1.078374, -0.572647],
      Pinky: [0.3815, 1.071569, 0.555865, -0.757189],
      Thumb: [0.08686, 1.32263, 1.02672, 0.882856, -1.057709],
      Ring: [0.1, 1.5, 0.31, -0.321426],
    }
  },
  drink: {
    position: [0.00483, 0.11836, -0.10502], rotation: [-Math.PI, 0, -Math.PI/2],
    palmRoll: -Math.PI/2, wristRoll: 70 * Math.PI/180,
    profile: {
      Index: [0.96807, 0.42355, 0.83677, -0.8],
      Middle: [0.23184, 0.25344, 1.12137, 0.27292],
      Pinky: [0.37885, 1.5, 0.25903, 0.75622],
      Thumb: [0.14942, 0.02001, 1.09453, 0.58043, -1.1],
      Ring: [0.49412, 0.59124, 0.93214, 0.25462],
    }
  },
  chips: {
    position: [0.01993, 0.150488, -0.087442], rotation: [-3.141593, 0, -1.570796],
    palmRoll: -Math.PI/2, wristRoll: 180 * Math.PI/180,
    size: [1.2, 1.08, 1],
    profile: {
      Index: [1.0076, 0.30915, 1.42442, -0.99071],
      Middle: [1.57697, 0.4107, 0.31378, -1.1],
      Pinky: [0.05309, 0.33866, 0.94733, 0.3079],
      Thumb: [0.44113, 1.26564, 0.36437, -1.43588, 0.51296],
      Ring: [0.71402, 1.25164, 0.95514, 0.00331],
    }
  },
  noodles: {
    position: [-0.005076, 0.149878, -0.086232], rotation: [-3.141593, 0, -1.570796],
    palmRoll: -Math.PI/2, wristRoll: 180 * Math.PI/180,
    size: [1.16, 1.06, 1],
    profile: {
      Index: [0.375024, 1.5, 1.046862, -0.85],
      Middle: [1.405619, 0.31, 0.725332, 0.85],
      Pinky: [0.522198, 1.5, 1.167138, 0.348405],
      Thumb: [-0.4, 0.965475, 0, 0.496156, -0.448674],
      Ring: [0.71402, 1.25164, 0.95514, 0.00331],
    }
  },
  snack: {
    position: [0.005459, 0.11754, -0.07971], rotation: [-3.141593, 0, -1.570796],
    palmRoll: -Math.PI/2, wristRoll: 180 * Math.PI/180,
    size: [1.08, 1.03, 1],
    profile: {
      Index: [0.141516, 1.5, 0.572437, -0.84585],
      Middle: [0.1, 1.5, 0.800291, -0.210669],
      Pinky: [0.1101, 1.5, 1.4, 0.404965],
      Thumb: [-0.182578, 1.126113, 0.376929, 0.675296, -1.042062],
      Ring: [0.71402, 1.25164, 0.95514, 0.00331],
    }
  },
};
