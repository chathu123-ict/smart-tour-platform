
"use strict";

const RATES = Object.freeze({
  driverPickup: 70,
  customerGoing: 100,
  customerReturn: 100,
  extraPickup: 60,
  driverReturn: 40,
});

function calculateTourPrice({
  tripType,
  basePrice,
  driverPickupKm,
  outboundKm,
  returnKm = 0,
  extraPickupKm = 0,
  driverReturnKm,
  translatorFee = 0,
  durationHours,
}) {
  if (!["one-way", "round-trip"].includes(tripType)) {
    throw new Error("Invalid trip type");
  }

  const values = {
    basePrice,
    driverPickupKm,
    outboundKm,
    returnKm,
    extraPickupKm,
    driverReturnKm,
    translatorFee,
    durationHours,
  };

  // Validate all financial and distance inputs.
  for (const [key, value] of Object.entries(values)) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new Error(`Invalid value: ${key}`);
    }
  }

  if (durationHours <= 0 || durationHours > 24) {
    throw new Error("Day tour must finish within 24 hours");
  }

  if (tripType === "one-way" && returnKm !== 0) {
    throw new Error("One-way tour cannot have customer return km");
  }

  const money = (amount) => Math.round(amount * 100) / 100;

  const breakdown = {
    basePrice: money(basePrice),
    driverPickupCharge: money(driverPickupKm * RATES.driverPickup),
    outboundCharge: money(outboundKm * RATES.customerGoing),
    customerReturnCharge: money(returnKm * RATES.customerReturn),
    extraPickupCharge: money(extraPickupKm * RATES.extraPickup),
    driverReturnCharge: money(driverReturnKm * RATES.driverReturn),
    translatorCharge: money(translatorFee),
  };

  const totalPrice = money(
    Object.values(breakdown).reduce(
      (total, charge) => total + charge,
      0
    )
  );

  return {
    tripType,
    rates: RATES,
    breakdown,
    travelCharge: money(
      totalPrice - breakdown.basePrice - breakdown.translatorCharge
    ),
    totalPrice,
  };
}

module.exports = {
  RATES,
  calculateTourPrice,
};
