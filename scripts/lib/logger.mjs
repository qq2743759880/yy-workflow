/** TT logger. */ 
export function createLogger(verbose) { 
  if (verbose === undefined) verbose = false; 
  const prefix = '[tt]'; 
  function info() { console.log(prefix, ...arguments); } 
  function warn() { console.warn(prefix, '[warn]', ...arguments); } 
  function error() { console.error(prefix, '[error]', ...arguments); } 
  function debug() { if (verbose) console.log(prefix, '[debug]', ...arguments); } 
  return { info, warn, error, debug }; 
}
