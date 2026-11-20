import { TUNING_MODEL_URL } from "../../lib/tuning-zone";
import { GOLF_PARTS } from "./car-parts";

// The showroom's cars. Each entry says what its 3D model really contains, so the configurator only offers what works
// on that car (docs/audit/tuning-zone.md, "Showroom"):
// - parts: which meshes and materials each option group changes (first match wins, as in GOLF_PARTS);
// - chassis: the wheel, brake and disc nodes the drive spins and steers;
// - groups: the option groups this model supports (checked against its parts when it loads);
// - cabin: the camera can enter through an opening driver door; doors: the door animation's name;
// - length: metres along the car once normalised (the real car's), so sizes stay true to each other.
const SHOWROOM_PARTS = [
  ["paint", (mesh, material) => /^Body Paint/.test(material)],
  ["glass", (mesh, material) => /^Window Glass/.test(material)],
  ["headlights", (mesh, material) => /^Headlight Lens/.test(material)],
  ["drl", (mesh, material) => /^Headlight LED/.test(material)],
  ["tailOuter", (mesh, material) => /^Taillight Lens/.test(material)],
  ["tailLeds", (mesh, material) => /^Taillight LED/.test(material)],
  ["calipers", (mesh, material) => /^Brake Caliper/.test(material)],
  ["seats", (mesh, material) => /^Seat Upholstery/.test(material)],
];

const SHOWROOM_CHASSIS = { wheel: "WHEEL_", brakes: { FL: "BRAKE_FL", FR: "BRAKE_FR" }, discs: {}, rearDiscs: null, sprung: /^BODY$/ };

const TIGUAN_PARTS = [
  ["paint", (mesh, material) => /^gris ascot/i.test(material)],
  ["glass", (mesh) => /^(Ext_Door_[FR][LR]#Glass_Windows|Int_Door_[FR][LR]#Glass_Clear|Ext_Window_R[LR]#Glass_Windows|Int_Window_R[LR]#Glass_Clear)/.test(mesh)],
  ["headlights", (mesh) => /^Ext_Headlights#Glass/.test(mesh)],
  ["tailOuter", (mesh) => /^Ext_Taillight#Glass/.test(mesh)],
  ["tailInner", (mesh) => /^(Ext#Taillights_Chrome_Red_AO|Ext_Trunk_Lid#Taillight_Chrome_Red_AO)/.test(mesh)],
  ["drl", (mesh) => /^Ext#Headlights_Reflector_White_AO/.test(mesh)],
  ["tailLeds", (mesh) => /^Ext#Taillights_Reflector_Red_AO/.test(mesh)],
  ["seats", (mesh, material) => /^Int_Seats/.test(mesh) && /leather/i.test(material)],
  ["stitching", (mesh, material) => /^Int_Seats/.test(mesh) && /^stitching/i.test(material)],
  ["steering", (mesh) => /^Int_SW#Leather/.test(mesh)],
  ["trim", (mesh, material) => /^wood trim/i.test(material)],
  ["belts", (mesh) => /^Int_Seats#Seatbelt/.test(mesh)],
  ["console", (mesh) => /^(Int#Leather_Black_Smooth|Int_Cupholder_(Rest|Strap)#Leather)/.test(mesh)],
  ["doors", (mesh) => /^Int_Door_[FR][LR]#Leather_Brown_Smooth/.test(mesh)],
  ["carpet", (mesh) => /^Int#Carpet_Legroom/.test(mesh)],
  ["headliner", (mesh, material) => /^(roofliner dark|pillars dark|sun visor black)/i.test(material)],
  ["ambient", (mesh, material) => /^(ambilight tiguan( legroom)?|tiguan my25 (cockpit|int doors) ambilight)/i.test(material)],
];

const LIGHTS = ["frontLights", "ledColor", "headlights", "rearLights", "taillights"];

// Section texts and notes that differ from the Golf's (which name its own parts), as translation keys.
const SHOWROOM_TEXTS = { wheels: "tuning.showroom.texts.wheels", interior: "tuning.showroom.texts.interior" };
const SHOWROOM_NOTES = { wheels: "tuning.showroom.notes.wheels", lights: "tuning.showroom.notes.lights", interior: "tuning.showroom.notes.interior" };

export const VEHICLES = [
  {
    id: "golf",
    make: "Volkswagen",
    model: "Golf GTI",
    body: "hatchback",
    url: TUNING_MODEL_URL,
    length: 4.3,
    parts: GOLF_PARTS,
    chassis: {
      wheel: "JEREZ_19_",
      brakes: { FL: "BRAKE_FL", FR: "BRAKE_FR" },
      discs: { FL: /^Ext_Brake_FL_Rotor$/, FR: /^Ext_Brake_FR_Rotor$/ },
      rearDiscs: /^Ext_Brake_Rear_(Discs|Rotors)/,
      sprung: /^(EXT_BODY|EXT_DOORS|EXT_TRUNK|INTERIOR)/,
    },
    doors: "Front left door",
    cabin: true,
    engineBay: true,
    groups: null, // all of them
    paint: "#d11616",
    credit: { title: "Volkswagen Golf GTI (2025)", author: "geyges", url: "https://sketchfab.com/3d-models/84fe6c2b9feb4c8a854d16f3daf33eab", licence: "standard" },
  },
  {
    id: "rs6",
    texts: SHOWROOM_TEXTS,
    notes: SHOWROOM_NOTES,
    make: "Audi",
    model: "RS 6 Avant",
    body: "estate",
    url: "/models/rs6.glb",
    length: 4.995,
    parts: SHOWROOM_PARTS,
    chassis: SHOWROOM_CHASSIS,
    groups: ["paint", "finish", "calipers", "stance", "frontLights", "ledColor", "rearLights", "seats"],
    paint: "#cb8c00",
    credit: { title: "Audi RS7 Sportback – Realistic Car 3D Model", author: "DevPoly3D", url: "https://sketchfab.com/3d-models/e668437afccf4896aa1d2aac8a2daca2", licence: "cc-by" },
  },
  {
    id: "m3",
    texts: SHOWROOM_TEXTS,
    notes: SHOWROOM_NOTES,
    make: "BMW",
    model: "M3 Competition",
    body: "saloon",
    url: "/models/m3.glb",
    length: 4.793,
    parts: SHOWROOM_PARTS,
    chassis: SHOWROOM_CHASSIS,
    groups: ["paint", "finish", "calipers", "stance", "tint", "frontLights", "ledColor", "headlights", "taillights"],
    paint: "#006114",
    credit: { title: "2021 BMW M3 Competition (G80)", author: "DisneyCars", url: "https://sketchfab.com/3d-models/a9027a26b7ee4da4b564d939b6c27559", licence: "cc-by" },
  },
  {
    id: "tiguan",
    texts: { wheels: "tuning.showroom.texts.wheelsStance" },
    notes: { wheels: "tuning.showroom.notes.tiguanWheels", lights: "tuning.showroom.notes.lights" },
    make: "Volkswagen",
    model: "Tiguan",
    body: "suv",
    url: "/models/tiguan.glb",
    length: 4.694,
    parts: TIGUAN_PARTS,
    chassis: {
      wheel: "ALUMINUM_19_",
      brakes: { FL: "BRAKE_FL", FR: "BRAKE_FR" },
      discs: { FL: /^Ext_Brake_FL(_Rotor)?#/, FR: /^Ext_Brake_FR(_Rotor)?#/ },
      rearDiscs: /^Ext_Brake_Rear_Rotors/,
      sprung: /^(EXT_BODY|EXT_DOORS|EXT_TRUNK|INTERIOR)/,
    },
    doors: "Front left door",
    cabin: true,
    groups: ["paint", "finish", "stance", "tint", ...LIGHTS, "tailTone", "seats", "stitching", "steering", "trim", "belts", "console", "doors", "carpet", "headliner", "ambient"],
    paint: "#9ea09d",
    credit: { title: "Volkswagen Tiguan (2025)", author: "geyges", url: "https://sketchfab.com/3d-models/18333bf2a9564772917ae8a349b81e62", licence: "standard" },
  },
  {
    id: "c63",
    texts: SHOWROOM_TEXTS,
    notes: SHOWROOM_NOTES,
    make: "Mercedes-AMG",
    model: "C 63 Coupé",
    body: "coupe",
    url: "/models/c63.glb",
    length: 4.748,
    parts: SHOWROOM_PARTS,
    chassis: SHOWROOM_CHASSIS,
    groups: ["paint", "finish", "calipers", "stance", "frontLights", "ledColor", "rearLights", "taillights", "seats"],
    paint: "#d2d2d2",
    // Uploaded to Sketchfab by tdh082 with the original author's licence file; the licence names the original.
    credit: { title: "Mercedes C63 Coupe", author: "ishaknapitupulucxr2", url: "https://sketchfab.com/3d-models/03fa574a59ff45e4b1edb1662dc04bf9", licence: "cc-by" },
  },
  {
    id: "supra",
    texts: SHOWROOM_TEXTS,
    notes: SHOWROOM_NOTES,
    make: "Toyota",
    model: "GR Supra",
    body: "sports",
    url: "/models/supra.glb",
    length: 4.379,
    parts: SHOWROOM_PARTS,
    chassis: SHOWROOM_CHASSIS,
    groups: ["paint", "finish", "calipers", "stance", "tint", "frontLights", "ledColor", "headlights", "rearLights", "seats"],
    paint: "#f2f2f0",
    credit: { title: "Toyota Supra MK5 A90", author: "pryanex", url: "https://sketchfab.com/3d-models/30528ef37af844919074498f979b9515", licence: "cc-by" },
  },
];

export const DEFAULT_VEHICLE = VEHICLES[0];

export function vehicleById(id) {
  return VEHICLES.find((vehicle) => vehicle.id === id) || DEFAULT_VEHICLE;
}

export function hasGroup(vehicle, group) {
  return !vehicle.groups || vehicle.groups.includes(group);
}

// The Golf normalised: what every camera view, the cabin path and the lamp positions were tuned on.
export const REFERENCE_SIZE = { x: 2.099, y: 1.492, z: 4.3 };
