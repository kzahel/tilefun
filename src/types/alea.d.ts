declare module "alea" {
  function alea(seed: string): () => number;
  export = alea;
}
