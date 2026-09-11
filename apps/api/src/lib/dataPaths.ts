// D:\dev\loyo-os\apps\api\src\lib\dataPaths.ts
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Jediné místo, kde se počítá cesta ke kořenové složce data/.
// Pokud se v budoucnu přesune struktura projektu, opravuje se jen tady.
const DEFAULT_DATA_DIR = resolve(__dirname, '../../../../data')
export const DATA_DIR = process.env.LOYO_DATA_DIR ? resolve(process.env.LOYO_DATA_DIR) : DEFAULT_DATA_DIR
