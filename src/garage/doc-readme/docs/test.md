测试
==========
## 单元测试
如果你的unit test spec是基于Jasmine 2.x的，可以直接使用`gulp test`命令进行测试，无须在package内添加jasmine的dependency了。
```
gulp test [-p package-short-name] [-f spec-file-path] [-spec spec-name-filter]
```
每个package下的`spec`目录下的所有`**/*[sS]pec.js`被视为是unit test文件, 所有`helpers/**/*.js` 的文件被视为Jasmin helpers.

查看 [Jasmine2.4 introduction](http://jasmine.github.io/2.4/introduction.html)

#### 1. 运行所有package的测试
```
gulp test
```
#### 2. 运行某几个package的测试

```
gulp test -p translate-generator [-p ...]
```

#### 3. 运行某个测试spec文件
```
gulp test -f src/internal/lib/translate-generator/spec/jsParserSpec.js
```
