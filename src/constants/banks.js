const BANK_TYPES = Object.freeze({
  HYUNDAI: "hyundai",
  SAMSUNG: "samsung",
});

const SUPPORTED_BANKS = Object.freeze(Object.values(BANK_TYPES));

module.exports = {
  BANK_TYPES,
  SUPPORTED_BANKS,
};
