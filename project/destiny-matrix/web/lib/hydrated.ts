import { useEffect, useState } from "react";

// До гидратации обработчики не подключены, и браузер отправляет форму сам: почта и пароль уходят
// в строку адреса, а оттуда в логи и историю. Выбор в полях React тоже затирает своим начальным
// состоянием — человек платил за дату, которую не вводил.
export function useHydrated(): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => setYes(true), []);
  return yes;
}
