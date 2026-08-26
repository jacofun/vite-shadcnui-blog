---
title: transient 为什么会让响应字段消失
slug: spring-transient-json
summary: Spring Boot 返回对象时，字段在调试器中有值，JSON 响应却为空的排查记录。
date: 2026-08-05
updated: 2026-08-25
category: 工程与架构
tags:
  - Java
  - Spring Boot
  - Jackson
draft: false
---

# transient 为什么会让响应字段消失

接口返回结构包含 `code`、`msg` 和 `result`。调试时 `result` 是有数据的 HashMap，最终 JSON 中却没有这个字段。

## 原因

Java 的 `transient` 用于标记不参与默认序列化的字段。Jackson 在处理对象时也会识别这一语义，因此字段虽然存在于内存中，仍会被排除在 JSON 输出之外。

```java
public class ApiResponse {
    private String code;
    private String msg;
    private transient Object result;
}
```

去掉 `transient` 后，`result` 会重新进入序列化过程。

## 排查顺序

1. 检查字段是否带有 `transient`、`static` 或忽略注解。
2. 检查 getter 是否存在以及访问级别。
3. 检查 Jackson 的全局 ObjectMapper 配置。
4. 检查响应包装器和 ResponseBodyAdvice 是否再次处理结果。
5. 直接使用 ObjectMapper 序列化该对象进行隔离验证。

> 调试器展示的是 JVM 中的对象状态，HTTP 响应展示的是序列化器选择后的结果，两者需要分开检查。
