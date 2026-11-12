// O pacote "dist-min" do Plotly não traz tipos; usa os de @types/plotly.js.
declare module "plotly.js-dist-min" {
  import * as Plotly from "plotly.js";
  export default Plotly;
}
