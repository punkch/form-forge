import { describe, expect, it } from 'vitest'

import { checkBalance, extractRefs, findRefs, maskStringLiterals } from './tokenizer'

describe('maskStringLiterals', () => {
  it('masks single and double quoted content, preserving length', () => {
    const expr = "selected(${q}, 'yes') and . != \"no}\""
    const masked = maskStringLiterals(expr)
    expect(masked.length).toBe(expr.length)
    expect(masked).not.toContain('yes')
    expect(masked).not.toContain('no}')
    expect(masked).toContain('${q}')
  })

  it('masks to the end on unterminated strings', () => {
    expect(maskStringLiterals("concat('abc")).toBe("concat('   ")
  })
})

describe('checkBalance', () => {
  it.each([
    '. >= 0 and . <= ${limit}',
    "if(selected(., 'none'), count-selected(.) = 1, true())",
    "regex(., '^[0-9(){}]+$')",
    "instance('crops')/root/item[name = ${crop}]/yield",
  ])('accepts balanced: %s', (expr) => {
    expect(checkBalance(expr)).toEqual([])
  })

  it('reports unterminated strings', () => {
    const issues = checkBalance("concat('abc, ${x})")
    expect(issues.some((i) => i.code === 'expr.unterminated-string')).toBe(true)
  })

  it('reports unmatched closers and openers', () => {
    expect(checkBalance('count(.))').some((i) => i.code === 'expr.unbalanced')).toBe(true)
    expect(checkBalance('sum(${a}').some((i) => i.code === 'expr.unbalanced')).toBe(true)
    expect(checkBalance('item[1)').some((i) => i.code === 'expr.unbalanced')).toBe(true)
  })

  it('ignores brackets inside strings', () => {
    expect(checkBalance("regex(., '^[({]+$')")).toEqual([])
  })
})

describe('findRefs / extractRefs', () => {
  it('finds refs with positions', () => {
    const refs = findRefs('${age} > 18 and ${ age } < 99')
    expect(refs.map((r) => r.name)).toEqual(['age', 'age'])
    expect(refs[0].start).toBe(0)
    expect(refs[0].end).toBe(6)
  })

  it('ignores refs inside string literals', () => {
    expect(extractRefs("concat('${not_a_ref}', ${real})")).toEqual(['real'])
  })

  it('deduplicates names', () => {
    expect(extractRefs('${a} + ${b} + ${a}')).toEqual(['a', 'b'])
  })
})
