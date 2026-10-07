import MeralcoLogo from "../../assets/svg/settings/companies/meralco.svg";
import AboitizLogo from "../../assets/svg/settings/companies/aboitiz.svg";
import AcenLogo from "../../assets/svg/settings/companies/acen.svg";
import SanMiguelLogo from "../../assets/svg/settings/companies/san_miguel.svg";
import FirstGenLogo from "../../assets/svg/settings/companies/first_gen.svg";
import CustomLogo from "../../assets/svg/settings/companies/custom.svg";

export const DEFAULT_PROVIDER_ID = "meralco";
export const DEFAULT_RATE = 15;

export const ELECTRICITY_PROVIDERS = [
  {
    id: "meralco",
    name: "Meralco",
    shortName: "Meralco",
    rate: 15,
    Logo: MeralcoLogo,
  },
  {
    id: "aboitiz",
    name: "AboitizPower Corporation",
    shortName: "AboitizPower",
    rate: 16,
    Logo: AboitizLogo,
  },
  {
    id: "acen",
    name: "ACEN Corporation",
    shortName: "ACEN",
    rate: 17,
    Logo: AcenLogo,
  },
  {
    id: "san_miguel",
    name: "San Miguel Corp.",
    shortName: "San Miguel Corp.",
    rate: 18,
    Logo: SanMiguelLogo,
  },
  {
    id: "first_gen",
    name: "First Gen Corporation",
    shortName: "First Gen",
    rate: 19,
    Logo: FirstGenLogo,
  },
];

export const CUSTOM_PROVIDER = {
  id: "custom",
  name: "I'd like to input it myself",
  shortName: "Custom",
  rate: null,
  Logo: CustomLogo,
};

export function getProviderById(providerId) {
  if (providerId === CUSTOM_PROVIDER.id) return CUSTOM_PROVIDER;
  return (
    ELECTRICITY_PROVIDERS.find((provider) => provider.id === providerId) ||
    ELECTRICITY_PROVIDERS[0]
  );
}

export function formatRateLabel(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(2);
}
