from setuptools import setup, find_namespace_packages

setup(
    name="mediadoc-studio",
    version="0.1.0",
    description="Cross-platform media and document conversion utility",
    packages=find_namespace_packages(include=["packages*"]),
    python_requires=">=3.10",
    install_requires=[
        "click>=8.1.0",
        "rich>=13.0.0",
        "Pillow>=10.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=8.0.0",
            "pytest-cov>=5.0.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "mediadoc=packages.domain.cli:cli",
        ]
    }
)
