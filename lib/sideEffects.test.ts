import { runAfterResponse } from '@/lib/sideEffects'

describe('runAfterResponse', () => {
  it('runs the task outside a request scope and swallows/logs failures', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const ok = jest.fn().mockResolvedValue(undefined)
    expect(() => runAfterResponse('ok', ok)).not.toThrow()
    expect(() => runAfterResponse('fail', () => Promise.reject(new Error('down')))).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
    expect(ok).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('[after:fail] side effect failed', expect.any(Error))
    spy.mockRestore()
  })
})
