// Golf 8.5 (2024 facelift) factory figures, as published by Volkswagen for EU models.
// Every value carries its source so the page can say what is manufacturer data and what is an estimate.
export const POWERTRAINS = {
  gti: {
    engine: "2.0 TSI EA888 evo4",
    gearbox: "dsg7",
    drive: "fwd",
    power: { ps: 265, kw: 195 },
    torque: 370,
    sprint: 5.9,
    topSpeed: 250,
  },
  clubsport: {
    engine: "2.0 TSI EA888 evo4",
    gearbox: "dsg7",
    drive: "fwd",
    power: { ps: 300, kw: 221 },
    torque: 400,
    sprint: 5.6,
    topSpeed: 250,
  },
  r: {
    engine: "2.0 TSI EA888 evo4",
    gearbox: "dsg7",
    drive: "awd",
    power: { ps: 333, kw: 245 },
    torque: 420,
    sprint: 4.6,
    topSpeed: 250,
  },
};

// Typical ranges published by aftermarket tuners for these engines. Not tested here, not approved by the manufacturer.
export const STAGES = {
  "stage-1": {
    gti: { power: [310, 330], torque: [420, 450] },
    clubsport: { power: [330, 350], torque: [440, 470] },
    r: { power: [370, 390], torque: [460, 490] },
  },
  "stage-2": {
    gti: { power: [350, 370], torque: [460, 500] },
    clubsport: { power: [360, 380], torque: [470, 500] },
    r: { power: [400, 420], torque: [500, 530] },
  },
};

export const POWER_SCALE = 420;
export const TORQUE_SCALE = 530;

export function performanceOf(powertrain, stage) {
  const base = POWERTRAINS[powertrain] || POWERTRAINS.gti;
  const tune = STAGES[stage]?.[powertrain];

  if (!tune) {
    return { base, estimated: false, power: [base.power.ps, base.power.ps], torque: [base.torque, base.torque] };
  }

  return { base, estimated: true, power: tune.power, torque: tune.torque };
}
