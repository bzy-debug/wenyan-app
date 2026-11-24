declare module "virtual:wenyan-readings" {
  const readings: import("./compileReadings").Reading[];
  export default readings;
}
