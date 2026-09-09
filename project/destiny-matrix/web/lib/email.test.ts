import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  emailError,
  emailProblem,
  emailProblemMessage,
  isValidEmail,
  normalizeEmail,
  type EmailProblem,
} from "./email";

interface Corpus {
  normalize: Array<{ raw: string; value: string }>;
  valid: string[];
  invalid: Array<{ value: string; problem: EmailProblem }>;
}

const CORPUS: Corpus = JSON.parse(
  readFileSync(path.join(__dirname, "..", "..", "spec", "email-cases.json"), "utf8"),
);

// Ровно тот шаблон, который стоял в четырёх местах до 8 сентября 2026. Здесь он остался как
// улика: тест ниже показывает, что именно он пропускал покупателя к отказу сервера.
const OLD_RE = /^\S+@\S+\.\S+$/;

describe("нормализация адреса", () => {
  for (const { raw, value } of CORPUS.normalize) {
    it(`${JSON.stringify(raw)} → ${JSON.stringify(value)}`, () => {
      expect(normalizeEmail(raw)).toBe(value);
    });
  }

  it("повторная нормализация ничего не меняет", () => {
    for (const { raw } of CORPUS.normalize) {
      const once = normalizeEmail(raw);
      expect(normalizeEmail(once)).toBe(once);
    }
  });

  it("не трогает точки внутри адреса", () => {
    expect(normalizeEmail("Ivan.Petrov@Mail.ru")).toBe("ivan.petrov@mail.ru");
    expect(normalizeEmail("user.@mail.ru")).toBe("user.@mail.ru");
    expect(normalizeEmail("user..name@mail.ru")).toBe("user..name@mail.ru");
  });

  it("не склеивает адрес через внутренний пробел", () => {
    expect(normalizeEmail("us er@mail.ru")).toBe("us er@mail.ru");
    expect(normalizeEmail("us er@mail.ru")).toBe("us er@mail.ru");
  });
});

describe("адреса, которые обязаны проходить", () => {
  for (const value of CORPUS.valid) {
    it(value, () => {
      expect(emailProblem(value)).toBeNull();
      expect(isValidEmail(value)).toBe(true);
      expect(emailError(value)).toBeNull();
    });
  }

  it("проходят и в непривычном регистре, и с пробелами по краям", () => {
    for (const value of CORPUS.valid) {
      expect(emailError(`  ${value.toUpperCase()}  `)).toBeNull();
    }
  });
});

describe("адреса, которые обязаны отсекаться", () => {
  for (const { value, problem } of CORPUS.invalid) {
    it(`${JSON.stringify(value.slice(0, 40))} → ${problem}`, () => {
      expect(emailProblem(value)).toBe(problem);
      expect(isValidEmail(value)).toBe(false);
      expect(emailError(value)).toBe(emailProblemMessage(problem));
    });
  }
});

describe("дефект 8 сентября 2026: точка перед @", () => {
  const broken = "tatyana123.@mail.ru";

  it("старый шаблон пропускал такой адрес к серверу", () => {
    expect(OLD_RE.test(broken)).toBe(true);
  });

  it("теперь адрес отсекается до запроса", () => {
    expect(isValidEmail(broken)).toBe(false);
    expect(emailProblem(broken)).toBe("local-dot-end");
  });

  it("человек читает, что именно исправить", () => {
    expect(emailError(broken)).toBe("Перед @ стоит точка — уберите её: you@mail.ru.");
  });

  it("тот же адрес без точки проходит", () => {
    expect(emailError("tatyana123@mail.ru")).toBeNull();
  });

  it("остальные ловушки старого шаблона тоже закрыты", () => {
    const missed = [
      "user..name@mail.ru",
      ".user@mail.ru",
      "user@mail..ru",
      "user@.mail.ru",
      "user@mail.ru.",
      "user@-mail.ru",
      "user@mail-.ru",
      "user@127.0.0.1",
      "user,name@mail.ru",
      "user@@mail.ru",
    ];
    for (const value of missed) {
      expect(OLD_RE.test(value), `старый шаблон пропускал ${value}`).toBe(true);
      expect(isValidEmail(value), `новый разбор обязан отсечь ${value}`).toBe(false);
    }
  });
});

describe("сообщения об ошибке", () => {
  const problems = CORPUS.invalid.map((c) => c.problem);

  it("каждое сообщение — законченная фраза для человека", () => {
    for (const problem of new Set(problems)) {
      const text = emailProblemMessage(problem);
      expect(text.length).toBeGreaterThan(10);
      expect(text.endsWith(".")).toBe(true);
      expect(text).not.toMatch(/[a-z]-[a-z]+-[a-z]/);
    }
  });

  it("не повторяют друг друга: по тексту видно, что чинить", () => {
    const texts = [...new Set(problems)].map(emailProblemMessage);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("на пустое поле просит ввести почту, а не «проверьте»", () => {
    expect(emailError("")).toBe("Введите почту.");
    expect(emailError("   ")).toBe("Введите почту.");
  });
});

describe("границы длины", () => {
  it("254 знака принимаются, 255 — нет", () => {
    const domain = "@mail.ru";
    const fits = "u".repeat(254 - domain.length) + domain;
    expect(fits).toHaveLength(254);
    expect(isValidEmail(fits)).toBe(true);
    expect(emailProblem(`u${fits}`)).toBe("too-long");
  });

  it("часть домена длиннее 63 знаков отсекается", () => {
    expect(isValidEmail(`user@${"a".repeat(63)}.ru`)).toBe(true);
    expect(emailProblem(`user@${"a".repeat(64)}.ru`)).toBe("label-too-long");
  });
});

describe("проверка почты живёт в одном месте", () => {
  const ROOT = path.join(__dirname, "..");
  const SKIP = new Set(["node_modules", ".next", "dist", "content"]);
  // Ровно этот шаблон и пропустил покупателя 8 сентября: любое его возвращение — тот же дефект.
  const WEAK = /\\S\+@\\S\+/;

  function sources(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sources(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("слабого шаблона нет ни в одном другом файле", () => {
    const guilty = sources(ROOT).filter((file) => {
      if (file.endsWith(path.join("lib", "email.test.ts"))) return false;
      return WEAK.test(readFileSync(file, "utf8"));
    });
    expect(guilty.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("каждая форма с почтой валидирует её общим модулем", () => {
    const forms = [
      path.join(ROOT, "components", "pay", "PayForm.tsx"),
      path.join(ROOT, "components", "account", "AuthForm.tsx"),
      path.join(ROOT, "components", "account", "ForgotForm.tsx"),
    ];
    for (const form of forms) {
      const code = readFileSync(form, "utf8");
      expect(code, path.relative(ROOT, form)).toContain('from "@/lib/email"');
      expect(code, path.relative(ROOT, form)).toContain("emailError(");
      // Браузерная проверка type=email пропускает точку перед @ и глушит нашу собственную:
      // без noValidate человек снова получит отказ без причины.
      expect(code, path.relative(ROOT, form)).toContain("noValidate");
    }
  });

  it("BFF проверяет почту тем же модулем", () => {
    for (const file of ["app/api/_lib/routes.ts", "app/api/auth/reset/request/route.ts"]) {
      const code = readFileSync(path.join(ROOT, file), "utf8");
      expect(code, file).toContain('from "@/lib/email"');
      expect(code, file).toContain("emailError(");
    }
  });
});

describe("порядок разбора: сначала то, что человек видит глазами", () => {
  it("про пробел говорим раньше, чем про остальное", () => {
    expect(emailProblem("us er.@mail.ru")).toBe("space");
  });

  it("про отсутствие @ говорим раньше, чем про домен", () => {
    expect(emailProblem("user.mail.ru")).toBe("no-at");
  });

  it("пустое поле важнее длины и формата", () => {
    expect(emailProblem("")).toBe("empty");
  });
});
