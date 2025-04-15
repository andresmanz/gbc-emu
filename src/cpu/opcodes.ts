export enum Opcode {
    NOP = 0x00,
    LD_BC_d16 = 0x01,
    LD_pBC_A = 0x02,
    INC_BC = 0x03,
    INC_B = 0x04,
    DEC_B = 0x05,
    LD_B_d8 = 0x06,
    RLCA = 0x07,
    LD_a16_SP = 0x08,
    ADD_HL_BC = 0x09,
    LD_A_pBC = 0x0a,
    DEC_BC = 0x0b,
    INC_C = 0x0c,
    DEC_C = 0x0d,
    LD_C_d8 = 0x0e,
    RRCA = 0x0f,

    STOP = 0x10,
    LD_DE_d16 = 0x11,
    LD_pDE_A = 0x12,
    INC_DE = 0x13,
    INC_D = 0x14,
    DEC_D = 0x15,
    LD_D_d8 = 0x16,
    RLA = 0x17,
    JR_imm8 = 0x18,
    ADD_HL_DE = 0x19,
    LD_A_pDE = 0x1a,
    DEC_DE = 0x1b,
    INC_E = 0x1c,
    DEC_E = 0x1d,
    LD_E_d8 = 0x1e,
    RRA = 0x1f,

    JR_NZ_imm8 = 0x20,
    LD_HL_d16 = 0x21,
    LD_pHLI_A = 0x22,
    INC_HL = 0x23,
    INC_H = 0x24,
    DEC_H = 0x25,
    LD_H_d8 = 0x26,
    DAA = 0x27,
    JR_Z_imm8 = 0x28,
    ADD_HL_HL = 0x29,
    LD_A_pHLI = 0x2a,
    DEC_HL = 0x2b,
    INC_L = 0x2c,
    DEC_L = 0x2d,
    LD_L_d8 = 0x2e,
    CPL = 0x2f,

    JR_NC_imm8 = 0x30,
    LD_SP_d16 = 0x31,
    LD_pHLD_A = 0x32,
    INC_SP = 0x33,
    INC_pHL = 0x34,
    DEC_pHL = 0x35,
    LD_pHL_d8 = 0x36,
    SCF = 0x37,
    JR_C_imm8 = 0x38,
    ADD_HL_SP = 0x39,
    LD_A_pHLD = 0x3a,
    DEC_SP = 0x3b,
    INC_A = 0x3c,
    DEC_A = 0x3d,
    LD_A_d8 = 0x3e,
    CCF = 0x3f,

    LD_B_B = 0x40,
    LD_B_C = 0x41,
    LD_B_D = 0x42,
    LD_B_E = 0x43,
    LD_B_H = 0x44,
    LD_B_L = 0x45,
    LD_B_pHL = 0x46,
    LD_B_A = 0x47,
    LD_C_B = 0x48,
    LD_C_C = 0x49,
    LD_C_D = 0x4a,
    LD_C_E = 0x4b,
    LD_C_H = 0x4c,
    LD_C_L = 0x4d,
    LD_C_pHL = 0x4e,
    LD_C_A = 0x4f,

    LD_D_B = 0x50,
    LD_D_C = 0x51,
    LD_D_D = 0x52,
    LD_D_E = 0x53,
    LD_D_H = 0x54,
    LD_D_L = 0x55,
    LD_D_pHL = 0x56,
    LD_D_A = 0x57,
    LD_E_B = 0x58,
    LD_E_C = 0x59,
    LD_E_D = 0x5a,
    LD_E_E = 0x5b,
    LD_E_H = 0x5c,
    LD_E_L = 0x5d,
    LD_E_pHL = 0x5e,
    LD_E_A = 0x5f,

    LD_H_B = 0x60,
    LD_H_C = 0x61,
    LD_H_D = 0x62,
    LD_H_E = 0x63,
    LD_H_H = 0x64,
    LD_H_L = 0x65,
    LD_H_pHL = 0x66,
    LD_H_A = 0x67,
    LD_L_B = 0x68,
    LD_L_C = 0x69,
    LD_L_D = 0x6a,
    LD_L_E = 0x6b,
    LD_L_H = 0x6c,
    LD_L_L = 0x6d,
    LD_L_pHL = 0x6e,
    LD_L_A = 0x6f,

    LD_pHL_B = 0x70,
    LD_pHL_C = 0x71,
    LD_pHL_D = 0x72,
    LD_pHL_E = 0x73,
    LD_pHL_H = 0x74,
    LD_pHL_L = 0x75,
    HALT = 0x76,
    LD_pHL_A = 0x77,
    LD_A_B = 0x78,
    LD_A_C = 0x79,
    LD_A_D = 0x7a,
    LD_A_E = 0x7b,
    LD_A_H = 0x7c,
    LD_A_L = 0x7d,
    LD_A_pHL = 0x7e,
    LD_A_A = 0x7f,

    ADD_A_B = 0x80,
    ADD_A_C = 0x81,
    ADD_A_D = 0x82,
    ADD_A_E = 0x83,
    ADD_A_H = 0x84,
    ADD_A_L = 0x85,
    ADD_A_pHL = 0x86,
    ADD_A_A = 0x87,
    ADC_A_B = 0x88,
    ADC_A_C = 0x89,
    ADC_A_D = 0x8a,
    ADC_A_E = 0x8b,
    ADC_A_H = 0x8c,
    ADC_A_L = 0x8d,
    ADC_A_pHL = 0x8e,
    ADC_A_A = 0x8f,

    SUB_A_B = 0x90,
    SUB_A_C = 0x91,
    SUB_A_D = 0x92,
    SUB_A_E = 0x93,
    SUB_A_H = 0x94,
    SUB_A_L = 0x95,
    SUB_A_pHL = 0x96,
    SUB_A_A = 0x97,
    SBC_A_B = 0x98,
    SBC_A_C = 0x99,
    SBC_A_D = 0x9a,
    SBC_A_E = 0x9b,
    SBC_A_H = 0x9c,
    SBC_A_L = 0x9d,
    SBC_A_pHL = 0x9e,
    SBC_A_A = 0x9f,

    AND_A_B = 0xa0,
    AND_A_C = 0xa1,
    AND_A_D = 0xa2,
    AND_A_E = 0xa3,
    AND_A_H = 0xa4,
    AND_A_L = 0xa5,
    AND_A_pHL = 0xa6,
    AND_A_A = 0xa7,
    XOR_A_B = 0xa8,
    XOR_A_C = 0xa9,
    XOR_A_D = 0xaa,
    XOR_A_E = 0xab,
    XOR_A_H = 0xac,
    XOR_A_L = 0xad,
    XOR_A_pHL = 0xae,
    XOR_A_A = 0xaf,

    OR_A_B = 0xb0,
    OR_A_C = 0xb1,
    OR_A_D = 0xb2,
    OR_A_E = 0xb3,
    OR_A_H = 0xb4,
    OR_A_L = 0xb5,
    OR_A_pHL = 0xb6,
    OR_A_A = 0xb7,
    CP_A_B = 0xb8,
    CP_A_C = 0xb9,
    CP_A_D = 0xba,
    CP_A_E = 0xbb,
    CP_A_H = 0xbc,
    CP_A_L = 0xbd,
    CP_A_pHL = 0xbe,
    CP_A_A = 0xbf,

    RET_NZ = 0xc0,
    POP_BC = 0xc1,
    JP_NZ_a16 = 0xc2,
    JP_a16 = 0xc3,
    CALL_NZ_imm16 = 0xc4,
    PUSH_BC = 0xc5,
    ADD_A_imm8 = 0xc6,
    RST_00H = 0xc7,
    RET_Z = 0xc8,
    RET = 0xc9,
    JP_Z_a16 = 0xca,
    PREFIX_CB = 0xcb,
    CALL_Z_imm16 = 0xcc,
    CALL_imm16 = 0xcd,
    ADC_A_imm8 = 0xce,
    RST_08H = 0xcf,

    RET_NC = 0xd0,
    POP_DE = 0xd1,
    JP_NC_a16 = 0xd2,
    /* 0xD3: unused */ UNUSED_D3 = 0xd3,
    CALL_NC_imm16 = 0xd4,
    PUSH_DE = 0xd5,
    SUB_A_imm8 = 0xd6,
    RST_10H = 0xd7,
    RET_C = 0xd8,
    RETI = 0xd9,
    JP_C_a16 = 0xda,
    /* 0xDB: unused */ UNUSED_DB = 0xdb,
    CALL_C_imm16 = 0xdc,
    /* 0xDD: unused */ UNUSED_DD = 0xdd,
    SBC_A_imm8 = 0xde,
    RST_18H = 0xdf,

    LDH_pa8_A = 0xe0,
    POP_HL = 0xe1,
    LD_pC_A = 0xe2,
    /* 0xE3: unused */ UNUSED_E3 = 0xe3,
    /* 0xE4: unused */ UNUSED_E4 = 0xe4,
    PUSH_HL = 0xe5,
    AND_A_imm8 = 0xe6,
    RST_20H = 0xe7,
    ADD_SP_r8 = 0xe8,
    JP_HL = 0xe9,
    LD_p16_A = 0xea,
    /* 0xEB: unused */ UNUSED_EB = 0xeb,
    /* 0xEC: unused */ UNUSED_EC = 0xec,
    /* 0xED: unused */ UNUSED_ED = 0xed,
    XOR_A_imm8 = 0xee,
    RST_28H = 0xef,

    LDH_A_pa8 = 0xf0,
    POP_AF = 0xf1,
    LD_A_pC = 0xf2,
    DI = 0xf3,
    /* 0xF4: unused */ UNUSED_F4 = 0xf4,
    PUSH_AF = 0xf5,
    OR_A_imm8 = 0xf6,
    RST_30H = 0xf7,
    LD_HL_SP_r8 = 0xf8,
    LD_SP_HL = 0xf9,
    LD_A_p16 = 0xfa,
    EI = 0xfb,
    /* 0xFC: unused */ UNUSED_FC = 0xfc,
    /* 0xFD: unused */ UNUSED_FD = 0xfd,
    CP_A_imm8 = 0xfe,
    RST_38H = 0xff,
}
