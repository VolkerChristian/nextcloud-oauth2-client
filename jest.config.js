module.exports = {
    "roots": [
        "./"
    ],
    "testMatch": [
        "**/tests/**/*.[jt]s?(x)",
        "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "collectCoverage": true,
    "moduleDirectories": [
        "node_modules"
    ]
};