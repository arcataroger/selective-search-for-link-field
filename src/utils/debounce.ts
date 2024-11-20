/**
 * Creates a debounced version of a function, which delays its execution
 * until after a specified wait time has elapsed since the last invocation.
 *
 * @param func The function to debounce.
 * @param wait The number of milliseconds to wait before executing the function. Defaults to 250ms.
 * @returns A debounced version of the provided function.
 *
 * @example
 * ```typescript
 * const fetchData = debounce(async (url: string) => {
 *   const response = await fetch(url);
 *   return await response.json();
 * });
 * fetchData('/api/data').then((data) => console.log(data));
 *
 * const log = debounce((message: string) => console.log(message));
 * log('Hello'); // Executes after 250ms.
 * ```
 *
 * @author Thank you, ChatGPT
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number = 250
): ((...args: Parameters<T>) => ReturnType<T>) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return ((...args: Parameters<T>): ReturnType<T> => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise<ReturnType<T>>((resolve, reject) => {
            timeoutId = setTimeout(() => {
                try {
                    const result = func(...args);
                    if (result instanceof Promise) {
                        result.then(resolve).catch(reject);
                    } else {
                        resolve(result);
                    }
                } catch (error) {
                    reject(error);
                }
            }, wait);
        }) as ReturnType<T>;
    }) as T;
};