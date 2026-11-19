// C_PUSH constant 10
@10
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_POP local 0
@0
D=A
@LCL
D=M+D
@R13
M=D
@SP
AM=M-1
D=M
@R13
A=M
M=D
// C_PUSH constant 21
@21
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_PUSH constant 22
@22
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_POP argument 2
@2
D=A
@ARG
D=M+D
@R13
M=D
@SP
AM=M-1
D=M
@R13
A=M
M=D
// C_POP argument 1
@1
D=A
@ARG
D=M+D
@R13
M=D
@SP
AM=M-1
D=M
@R13
A=M
M=D
// C_PUSH constant 36
@36
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_POP this 6
@6
D=A
@THIS
D=M+D
@R13
M=D
@SP
AM=M-1
D=M
@R13
A=M
M=D
// C_PUSH constant 42
@42
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_PUSH constant 45
@45
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_POP that 5
@5
D=A
@THAT
D=M+D
@R13
M=D
@SP
AM=M-1
D=M
@R13
A=M
M=D
// C_POP that 2
@2
D=A
@THAT
D=M+D
@R13
M=D
@SP
AM=M-1
D=M
@R13
A=M
M=D
// C_PUSH constant 510
@510
D=A
@SP
A=M
M=D
@SP
M=M+1
// C_POP temp 6
@SP
AM=M-1
D=M
@11
M=D
// C_PUSH local 0
@0
D=A
@LCL
A=M+D
D=M
@SP
A=M
M=D
@SP
M=M+1
// C_PUSH that 5
@5
D=A
@THAT
A=M+D
D=M
@SP
A=M
M=D
@SP
M=M+1
// add
@SP
AM=M-1
D=M
A=A-1
M=M+D
// C_PUSH argument 1
@1
D=A
@ARG
A=M+D
D=M
@SP
A=M
M=D
@SP
M=M+1
// sub
@SP
AM=M-1
D=M
A=A-1
M=M-D
// C_PUSH this 6
@6
D=A
@THIS
A=M+D
D=M
@SP
A=M
M=D
@SP
M=M+1
// C_PUSH this 6
@6
D=A
@THIS
A=M+D
D=M
@SP
A=M
M=D
@SP
M=M+1
// add
@SP
AM=M-1
D=M
A=A-1
M=M+D
// sub
@SP
AM=M-1
D=M
A=A-1
M=M-D
// C_PUSH temp 6
@11
D=M
@SP
A=M
M=D
@SP
M=M+1
// add
@SP
AM=M-1
D=M
A=A-1
M=M+D
