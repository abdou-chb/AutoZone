// How each downloaded showroom car is read by showroom.mjs. Found by inspecting each model (inspect.mjs,
// materials.mjs): which side its nose faces, how its tyres are named, what to drop, and which of its materials play
// the parts the configurator changes. Lengths are the real cars' (manufacturer data), so the cars keep their sizes
// relative to each other.
//
// Shared material names (the scene's part rules match these):
// Body Paint, Window Glass, Headlight Lens, Headlight LED, Taillight Lens, Taillight LED, Brake Caliper, Seat Upholstery.
export const VEHICLES = {
  // Sold on Sketchfab as an "Audi RS7 Sportback", but its long roof and upright tailgate are the RS 6 Avant's.
  rs6: {
    nose: "+z",
    length: 4.995,
    triangles: 420000,
    tyre: /^Tyre/,
    drop: /^gROUND$/,
    materials: {
      "Body Paint": /^Car_Paint$/,
      "Headlight LED": /^Material\.00[12]$/,
      "Taillight LED": /^Light_red_emission$/,
      "Brake Caliper": /^Clipper$/,
      "Seat Upholstery": /^Top_Seat_Material$/,
    },
  },
  m3: {
    nose: "-z",
    length: 4.794,
    triangles: 380000,
    tyre: /^Steeringwheelcarbon11Mtl_24$/,
    materials: {
      "Body Paint": /^Merged_materials$/,
      "Window Glass": /^Window1Mtl$/,
      "Headlight Lens": /^Headlightglass1Mtl$/,
      "Headlight LED": /^Drl21Mtl/,
      "Taillight Lens": /^Taillightglass21Mtl/,
      "Brake Caliper": /^Calliperpaintrl1Mtl$/,
    },
  },
  c63: {
    nose: "+z",
    length: 4.751,
    triangles: 420000,
    tyre: /^Wheel_(lf|rf|lb|rb)_14/,
    // Its clear glass materials are shared by the windows and the headlamps, so neither is mapped.
    materials: {
      "Body Paint": /^kuzov$/,
      "Headlight LED": /^Emission$/,
      "Taillight Lens": /^r_glass$/,
      "Taillight LED": /^red\.001$/,
      "Brake Caliper": /^material_34$/,
      "Seat Upholstery": /^Leather$/,
    },
  },
  supra: {
    nose: "+z",
    length: 4.379,
    triangles: 420000,
    tyre: /^MKV\.Tire$/,
    materials: {
      "Body Paint": /^Supra_body_paint$/,
      "Window Glass": /^Window$/,
      "Headlight Lens": /^HeadlightGlass$/,
      "Headlight LED": /^(Runninglight|Headlight)$/,
      "Taillight LED": /^(Taillight|BrakeLight)$/,
      "Brake Caliper": /^Brake\.Caliper$/,
      "Seat Upholstery": /^(Leather|Alcantara)$/,
    },
  },
};
